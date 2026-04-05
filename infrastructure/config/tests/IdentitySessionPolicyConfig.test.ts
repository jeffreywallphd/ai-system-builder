import { describe, expect, it } from "bun:test";
import { IdentitySessionPolicyConfig } from "../IdentitySessionPolicyConfig";

describe("IdentitySessionPolicyConfig", () => {
  it("uses secure defaults when environment values are not provided", () => {
    const config = IdentitySessionPolicyConfig.fromEnv({});

    expect(config.policies.desktop.ttlMinutes).toBe(43200);
    expect(config.policies.desktop.allowRefresh).toBeFalse();
    expect(config.policies.desktop.inactivityTimeoutMinutes).toBeUndefined();
    expect(config.policies.thinClient.ttlMinutes).toBe(720);
    expect(config.policies.thinClient.allowRefresh).toBeTrue();
    expect(config.policies.thinClient.inactivityTimeoutMinutes).toBeUndefined();
  });

  it("loads channel-specific ttl, refresh, and inactivity values from environment variables", () => {
    const config = IdentitySessionPolicyConfig.fromEnv({
      IDENTITY_SESSION_DESKTOP_TTL_MINUTES: "2880",
      IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH: "true",
      IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES: "120",
      IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES: "90",
      IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH: "false",
      IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES: "15",
    });

    expect(config.policies.desktop.ttlMinutes).toBe(2880);
    expect(config.policies.desktop.allowRefresh).toBeTrue();
    expect(config.policies.desktop.inactivityTimeoutMinutes).toBe(120);
    expect(config.policies.thinClient.ttlMinutes).toBe(90);
    expect(config.policies.thinClient.allowRefresh).toBeFalse();
    expect(config.policies.thinClient.inactivityTimeoutMinutes).toBe(15);
  });

  it("rejects invalid or incoherent policy values", () => {
    expect(() => IdentitySessionPolicyConfig.fromEnv({
      IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES: "0",
    })).toThrow("integer >= 1");

    expect(() => IdentitySessionPolicyConfig.fromEnv({
      IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH: "maybe",
    })).toThrow("must be a boolean");

    expect(() => IdentitySessionPolicyConfig.fromEnv({
      IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES: "30",
      IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES: "60",
    })).toThrow("inactivityTimeoutMinutes <= ttlMinutes");
  });
});
