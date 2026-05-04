import path from "node:path";
import { X509Certificate } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TlsCertificateProviderPort, TlsCertificateStorePort } from "../../../application/ports/security";

const execFileAsync = promisify(execFile);
const CERT_FILE_NAME = "dev-self-signed-server.pem";
const KEY_FILE_NAME = "dev-self-signed-server-key.pem";
const LOCAL_CA_CERT_FILE_NAME = "local-dev-ca.pem";
const LOCAL_CA_KEY_FILE_NAME = "local-dev-ca-key.pem";
const LOCAL_SERVER_CERT_FILE_NAME = "local-dev-server.pem";
const LOCAL_SERVER_KEY_FILE_NAME = "local-dev-server-key.pem";

const isIpHost = (h: string) => /^\d|:/.test(h);

export function createSelfSignedTlsCertificateProvider(store: TlsCertificateStorePort): TlsCertificateProviderPort {
  return { async resolveCertificateMaterial(input) {
    if (!input.httpsEnabled && !input.httpsRequired) return undefined;
    if (input.mode === "manual") {
      if (!input.manualCertPath || !input.manualKeyPath) throw new Error("Manual TLS mode requires AI_SYSTEM_BUILDER_TLS_CERT_PATH and AI_SYSTEM_BUILDER_TLS_KEY_PATH when HTTPS is enabled.");
      const certPem = await store.readText(input.manualCertPath); const keyPem = await store.readText(input.manualKeyPath);
      return { certPem, keyPem, certificatePath: input.manualCertPath, keyPath: input.manualKeyPath, status: { mode: input.mode, enabled: true, source: "manual", certificatePath: input.manualCertPath, hosts: input.hosts } };
    }

    if (input.mode === "auto-local-ca") {
      const caCertPath = path.join(input.certificateDirectory, LOCAL_CA_CERT_FILE_NAME);
      const caKeyPath = path.join(input.certificateDirectory, LOCAL_CA_KEY_FILE_NAME);
      const certPath = path.join(input.certificateDirectory, LOCAL_SERVER_CERT_FILE_NAME);
      const keyPath = path.join(input.certificateDirectory, LOCAL_SERVER_KEY_FILE_NAME);
      const caCertExists = await store.fileExists(caCertPath); const caKeyExists = await store.fileExists(caKeyPath); const certExists = await store.fileExists(certPath); const keyExists = await store.fileExists(keyPath);
      if (caCertExists !== caKeyExists) throw new Error(`TLS local CA has partial state at '${input.certificateDirectory}'.`);
      if (certExists !== keyExists) throw new Error(`TLS local server certificate has partial state at '${input.certificateDirectory}'.`);
      const hasAny = caCertExists || caKeyExists || certExists || keyExists;
      const hasAll = caCertExists && caKeyExists && certExists && keyExists;
      if (hasAny && !hasAll) throw new Error(`TLS auto-local-ca directory has partial state at '${input.certificateDirectory}'. Refusing destructive overwrite.`);
      if (!hasAny) {
        await store.ensureDirectory(input.certificateDirectory);
        const subj = `/CN=AI System Builder Local Dev CA`;
        await execFileAsync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-keyout", caKeyPath, "-out", caCertPath, "-days", "3650", "-subj", subj, "-addext", "basicConstraints=critical,CA:true", "-addext", "keyUsage=critical,keyCertSign,cRLSign"]);
        const san = input.hosts.map((h) => (isIpHost(h) ? `IP:${h}` : `DNS:${h}`)).join(",");
        const csrPath = path.join(input.certificateDirectory, "local-dev-server.csr");
        await execFileAsync("openssl", ["req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", csrPath, "-subj", `/CN=${input.hosts[0] ?? "localhost"}`, "-addext", `subjectAltName=${san}`, "-addext", "extendedKeyUsage=serverAuth"]);
        const extPath = path.join(input.certificateDirectory, "local-dev-server.ext");
        await store.writeTextAtomic(extPath, `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`);
        await execFileAsync("openssl", ["x509", "-req", "-in", csrPath, "-CA", caCertPath, "-CAkey", caKeyPath, "-CAcreateserial", "-out", certPath, "-days", "825", "-sha256", "-extfile", extPath]);
      }
      const certPem = await store.readText(certPath); const keyPem = await store.readText(keyPath); const caPem = await store.readText(caCertPath);
      const expiresAt = new Date(new X509Certificate(certPem).validTo).toISOString();
      const caExpiresAt = new Date(new X509Certificate(caPem).validTo).toISOString();
      return { certPem, keyPem, certificatePath: certPath, keyPath, status: { mode: input.mode, enabled: true, source: hasAll ? "reused" : "generated", certificatePath: certPath, certificateDirectory: input.certificateDirectory, hosts: input.hosts, expiresAt, localCa: { available: true, source: hasAll ? "reused" : "generated", certificatePath: caCertPath, downloadUrl: "/api/security/tls/local-ca.pem", expiresAt: caExpiresAt, trustInstalled: false, trustInstallationRequired: true } } };
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
