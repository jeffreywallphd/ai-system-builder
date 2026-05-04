import path from "node:path";
import { X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TlsCertificateProviderPort, TlsCertificateStorePort } from "../../../application/ports/security";

const execFileAsync = promisify(execFile);
const CERT_FILE_NAME = "dev-self-signed-server.pem";
const KEY_FILE_NAME = "dev-self-signed-server-key.pem";

export function createSelfSignedTlsCertificateProvider(store: TlsCertificateStorePort): TlsCertificateProviderPort {
  return { async resolveCertificateMaterial(input) {
    if (!input.httpsEnabled && !input.httpsRequired) return undefined;
    if (input.mode === "auto-local-ca") throw new Error("TLS certificate mode 'auto-local-ca' is not implemented yet. Use 'manual' or 'auto-self-signed'.");
    if (input.mode === "manual") {
      if (!input.manualCertPath || !input.manualKeyPath) throw new Error("Manual TLS mode requires AI_SYSTEM_BUILDER_TLS_CERT_PATH and AI_SYSTEM_BUILDER_TLS_KEY_PATH when HTTPS is enabled.");
      const certPem = await store.readText(input.manualCertPath); const keyPem = await store.readText(input.manualKeyPath);
      return { certPem, keyPem, certificatePath: input.manualCertPath, keyPath: input.manualKeyPath, status: { mode: input.mode, enabled: true, source: "manual", certificatePath: input.manualCertPath, hosts: input.hosts } };
    }
    const certPath = path.join(input.certificateDirectory, CERT_FILE_NAME); const keyPath = path.join(input.certificateDirectory, KEY_FILE_NAME);
    const certExists = await store.fileExists(certPath); const keyExists = await store.fileExists(keyPath);
    if (certExists !== keyExists) throw new Error(`TLS certificate directory has partial state at '${input.certificateDirectory}'. Found only one of certificate/key files; delete both or repair manually.`);
    if (!certExists) {
      await store.ensureDirectory(input.certificateDirectory);
      const san = input.hosts.map((h) => (/^\d|:/.test(h) ? `IP:${h}` : `DNS:${h}`)).join(",");
      const subj = `/CN=${input.hosts[0] ?? "localhost"}`;
      await execFileAsync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "365", "-subj", subj, "-addext", `subjectAltName=${san}`, "-addext", "extendedKeyUsage=serverAuth"]);
    }
    const certPem = await store.readText(certPath); const keyPem = await store.readText(keyPath);
    const expiresAt = new Date(new X509Certificate(certPem).validTo).toISOString();
    return { certPem, keyPem, certificatePath: certPath, keyPath, status: { mode: input.mode, enabled: true, source: certExists ? "reused" : "generated", certificatePath: certPath, certificateDirectory: input.certificateDirectory, hosts: input.hosts, expiresAt } };
  }};
}
