import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "../../../modules/testing/node-test";
import { isThinClientViteHttpsEnabled, resolveThinClientViteHttpsConfig } from "../viteDevHttpsConfig";

describe("thin-client Vite HTTPS config", () => {
  it("returns false when thin-client HTTPS is disabled", () => {
    expect(resolveThinClientViteHttpsConfig({})).toBe(false);
    expect(resolveThinClientViteHttpsConfig({ AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "false" })).toBe(false);
    expect(isThinClientViteHttpsEnabled({ AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "false" })).toBe(false);
  });

  it("does not require cert or key paths when HTTPS is disabled", () => {
    expect(() =>
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "false",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: "",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: "",
      }),
    ).not.toThrow();
  });

  it("throws clear error when HTTPS is enabled without cert path", () => {
    expect(() =>
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: "/tmp/key.pem",
      }),
    ).toThrow(/AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH is required/);
  });

  it("throws clear error when HTTPS is enabled without key path", () => {
    expect(() =>
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: "/tmp/cert.pem",
      }),
    ).toThrow(/AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH is required/);
  });

  it("throws clear error when HTTPS is enabled and cert path is unreadable", () => {
    expect(() =>
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: "/definitely/missing/cert.pem",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: "/definitely/missing/key.pem",
      }),
    ).toThrow(/AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH could not be read/);
  });

  it("throws clear error when HTTPS is enabled and key path is unreadable", () => {
    const directory = mkdtempSync(join(tmpdir(), "thin-client-vite-https-"));
    const certPath = join(directory, "cert.pem");
    writeFileSync(certPath, "CERT-CONTENTS");

    expect(() =>
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: certPath,
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: join(directory, "missing-key.pem"),
      }),
    ).toThrow(/AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH could not be read/);

    rmSync(directory, { recursive: true, force: true });
  });

  it("returns cert and key buffers when HTTPS is enabled and files are readable", () => {
    const directory = mkdtempSync(join(tmpdir(), "thin-client-vite-https-"));
    const certPath = join(directory, "cert.pem");
    const keyPath = join(directory, "key.pem");
    const certContents = "CERT-CONTENTS";
    const keyContents = "PRIVATE-KEY-CONTENTS";
    writeFileSync(certPath, certContents);
    writeFileSync(keyPath, keyContents);

    const config = resolveThinClientViteHttpsConfig({
      AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
      AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: certPath,
      AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: keyPath,
    });

    expect(config).not.toBe(false);
    expect(Buffer.isBuffer(config && config.cert)).toBe(true);
    expect(Buffer.isBuffer(config && config.key)).toBe(true);
    expect(config && config.cert.toString("utf8")).toBe(certContents);
    expect(config && config.key.toString("utf8")).toBe(keyContents);
    expect(config && "certPath" in config).toBe(false);
    expect(config && "keyPath" in config).toBe(false);

    rmSync(directory, { recursive: true, force: true });
  });

  it("does not include private key contents in thrown errors", () => {
    const directory = mkdtempSync(join(tmpdir(), "thin-client-vite-https-"));
    const certPath = join(directory, "cert.pem");
    const keyPath = join(directory, "secret-key.pem");
    const privateKeyContent = "-----BEGIN PRIVATE KEY-----\nsuper-secret-key-material\n-----END PRIVATE KEY-----";
    writeFileSync(certPath, "CERT-CONTENTS");

    let error: unknown;
    try {
      resolveThinClientViteHttpsConfig({
        AI_SYSTEM_BUILDER_THIN_CLIENT_HTTPS_ENABLED: "true",
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_CERT_PATH: certPath,
        AI_SYSTEM_BUILDER_THIN_CLIENT_TLS_KEY_PATH: keyPath,
      });
    } catch (caughtError) {
      error = caughtError;
    }

    const message = error instanceof Error ? error.message : "";
    expect(message).not.toContain(privateKeyContent);
    expect(message).not.toContain("super-secret-key-material");

    rmSync(directory, { recursive: true, force: true });
  });
});
