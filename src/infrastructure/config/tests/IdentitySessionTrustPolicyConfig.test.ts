import { describe, expect, it } from "bun:test";
import { IdentitySessionTrustPolicyConfig } from "../IdentitySessionTrustPolicyConfig";

describe("IdentitySessionTrustPolicyConfig", () => {
  it("uses secure trust defaults when environment values are not provided", () => {
    const config = IdentitySessionTrustPolicyConfig.fromEnv({});

    expect(config.policies.desktop).toBe("allow-pairing");
    expect(config.policies.thinClient).toBe("allow-untrusted");
  });

  it("loads channel-specific trust requirements from environment variables", () => {
    const config = IdentitySessionTrustPolicyConfig.fromEnv({
      IDENTITY_SESSION_DESKTOP_TRUST_REQUIREMENT: "require-trusted",
      IDENTITY_SESSION_THIN_CLIENT_TRUST_REQUIREMENT: "allow-pairing",
    });

    expect(config.policies.desktop).toBe("require-trusted");
    expect(config.policies.thinClient).toBe("allow-pairing");
  });

  it("rejects invalid trust requirement values", () => {
    expect(() => IdentitySessionTrustPolicyConfig.fromEnv({
      IDENTITY_SESSION_DESKTOP_TRUST_REQUIREMENT: "sometimes",
    })).toThrow("must be one of");
  });
});
