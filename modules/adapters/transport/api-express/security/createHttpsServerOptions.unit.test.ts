import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createHttpsServerOptions } from "./createHttpsServerOptions";

describe("createHttpsServerOptions", () => {
  it("fails clearly when cert path is missing", () => {
    expect(() => createHttpsServerOptions(undefined, "/tmp/key.pem")).toThrow(/AI_SYSTEM_BUILDER_TLS_CERT_PATH/);
  });

  it("fails clearly when key path is missing", () => {
    expect(() => createHttpsServerOptions("/tmp/cert.pem", undefined)).toThrow(/AI_SYSTEM_BUILDER_TLS_KEY_PATH/);
  });

  it("fails clearly when files are unreadable/missing", () => {
    expect(() => createHttpsServerOptions("/tmp/no-cert.pem", "/tmp/no-key.pem")).toThrow(/not readable/);
  });

  it("returns cert/key buffers for valid files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "https-options-"));
    try {
      const cert = path.join(root, "cert.pem");
      const key = path.join(root, "key.pem");
      await writeFile(cert, "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n", "utf8");
      await writeFile(key, "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n", "utf8");
      const result = createHttpsServerOptions(cert, key);
      expect(Buffer.isBuffer(result.cert)).toBe(true);
      expect(Buffer.isBuffer(result.key)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
