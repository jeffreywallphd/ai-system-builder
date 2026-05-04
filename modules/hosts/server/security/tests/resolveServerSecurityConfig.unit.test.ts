import { describe, expect, it } from "vitest";
import { resolveServerSecurityConfig } from "../resolveServerSecurityConfig";

describe("resolveServerSecurityConfig", () => {
  it("resolves disabled-dev defaults", () => {
    const cfg = resolveServerSecurityConfig({}, "/tmp/storage");
    expect(cfg.mode).toBe("disabled-dev");
    expect(cfg.authRequired).toBe(false);
    expect(cfg.httpsRequired).toBe(false);
  });

  it("requires cert and key for lan-https-token", () => {
    expect(() => resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token" }, "/tmp/storage")).toThrow(/AI_SYSTEM_BUILDER_TLS_CERT_PATH/);
    expect(() => resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token", AI_SYSTEM_BUILDER_TLS_CERT_PATH: "/tmp/cert.pem" }, "/tmp/storage")).toThrow(/AI_SYSTEM_BUILDER_TLS_KEY_PATH/);
  });
});
