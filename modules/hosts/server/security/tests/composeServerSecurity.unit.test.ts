import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { composeServerSecurity } from "../composeServerSecurity";

function tlsEnv() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "security-test-"));
  const cert = path.join(dir, "cert.pem");
  const key = path.join(dir, "key.pem");
  writeFileSync(cert, "cert");
  writeFileSync(key, "key");
  return { AI_SYSTEM_BUILDER_TLS_CERT_PATH: cert, AI_SYSTEM_BUILDER_TLS_KEY_PATH: key };
}

describe("composeServerSecurity", () => {
  it("uses insecure fallback only in disabled-dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => composeServerSecurity({ AI_SYSTEM_BUILDER_SECURITY_MODE: "disabled-dev" } as any, "/tmp/x")).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
  it("fails lan-https-token without token hash secret", () => {
    expect(() => composeServerSecurity({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token", ...tlsEnv() } as any, "/tmp/x")).toThrow(/SERVER_TOKEN_HASH_SECRET is required/);
  });
  it("accepts lan-https-token with token hash secret", () => {
    expect(() => composeServerSecurity({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token", SERVER_TOKEN_HASH_SECRET: "abc123", ...tlsEnv() } as any, "/tmp/x")).not.toThrow();
  });
});
