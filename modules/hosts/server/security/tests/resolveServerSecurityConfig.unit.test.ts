import { describe, expect, it } from "vitest";
import { resolveServerSecurityConfig } from "../resolveServerSecurityConfig";

describe("resolveServerSecurityConfig", () => {
  it("resolves disabled-dev defaults", () => {
    const cfg = resolveServerSecurityConfig({}, "/tmp/storage");
    expect(cfg.mode).toBe("disabled-dev");
    expect(cfg.authRequired).toBe(false);
    expect(cfg.httpsRequired).toBe(false);
    expect(cfg.httpsEnabled).toBe(false);
    expect(cfg.devSecurityToggleEnabled).toBe(false);
  });

  it("supports HTTPS listener in disabled-dev when explicitly enabled", () => {
    const cfg = resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "disabled-dev", AI_SYSTEM_BUILDER_HTTPS_ENABLED: "true", AI_SYSTEM_BUILDER_TLS_CERT_PATH: "/tmp/cert.pem", AI_SYSTEM_BUILDER_TLS_KEY_PATH: "/tmp/key.pem" }, "/tmp/storage");
    expect(cfg.mode).toBe("disabled-dev");
    expect(cfg.httpsEnabled).toBe(true);
    expect(cfg.httpsRequired).toBe(false);
  });

  it("requires cert and key for lan-https-token", () => {
    expect(() => resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token" }, "/tmp/storage")).toThrow(/AI_SYSTEM_BUILDER_TLS_CERT_PATH/);
    expect(() => resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token", AI_SYSTEM_BUILDER_TLS_CERT_PATH: "/tmp/cert.pem" }, "/tmp/storage")).toThrow(/AI_SYSTEM_BUILDER_TLS_KEY_PATH/);
  });

  it("enables dev toggle only in disabled-dev", () => {
    expect(resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED: "true" }, "/tmp/storage").devSecurityToggleEnabled).toBe(true);
    const cfg = resolveServerSecurityConfig({ AI_SYSTEM_BUILDER_SECURITY_MODE: "lan-https-token", AI_SYSTEM_BUILDER_DEV_SECURITY_TOGGLE_ENABLED: "true", AI_SYSTEM_BUILDER_TLS_CERT_PATH: "/tmp/cert.pem", AI_SYSTEM_BUILDER_TLS_KEY_PATH: "/tmp/key.pem" }, "/tmp/storage");
    expect(cfg.devSecurityToggleEnabled).toBe(false);
  });
});
