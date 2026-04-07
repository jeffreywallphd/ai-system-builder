import { describe, expect, it } from "bun:test";
import { IdentityProviderAccountPolicyConfig } from "../IdentityProviderAccountPolicyConfig";

describe("IdentityProviderAccountPolicyConfig", () => {
  it("uses secure defaults when environment values are omitted", () => {
    const config = IdentityProviderAccountPolicyConfig.fromEnv({});

    expect(config.localProviderId).toBe("provider:local-password");
    expect(config.localProviderDisplayName).toBe("Local Password");
    expect(config.localCredentialPolicyId).toBe("policy:local-password");
    expect(config.localProviderEnabled).toBeTrue();
    expect(config.localProviderStatus).toBe("active");
    expect(config.bootstrapSeedDefaults).toBeTrue();
    expect(config.allowLocalRegistration).toBeTrue();
    expect(config.allowLocalAdministration).toBeTrue();

    const policy = config.buildLocalCredentialPolicy();
    expect(policy.minLength).toBe(12);
    expect(policy.maxLength).toBe(128);
    expect(policy.requireSymbol).toBeTrue();
  });

  it("loads provider toggles and credential-policy overrides from environment values", () => {
    const config = IdentityProviderAccountPolicyConfig.fromEnv({
      IDENTITY_LOCAL_PROVIDER_ENABLED: "false",
      IDENTITY_BOOTSTRAP_SEED_DEFAULTS: "true",
      IDENTITY_ACCOUNT_ALLOW_LOCAL_REGISTRATION: "false",
      IDENTITY_ACCOUNT_ALLOW_ADMINISTRATION: "false",
      IDENTITY_LOCAL_CREDENTIAL_MIN_LENGTH: "16",
      IDENTITY_LOCAL_CREDENTIAL_MAX_LENGTH: "256",
      IDENTITY_LOCAL_CREDENTIAL_BLOCKED_SUBSTRINGS: "password, admin ,password",
      IDENTITY_LOCAL_CREDENTIAL_MAX_FAILED_ATTEMPTS: "3",
    });

    expect(config.localProviderEnabled).toBeFalse();
    expect(config.localProviderStatus).toBe("disabled");
    expect(config.allowLocalRegistration).toBeFalse();
    expect(config.allowLocalAdministration).toBeFalse();
    const policy = config.buildLocalCredentialPolicy();
    expect(policy.minLength).toBe(16);
    expect(policy.maxLength).toBe(256);
    expect(policy.blockedSubstrings).toEqual(["password", "admin"]);
    expect(policy.maxFailedAttempts).toBe(3);
  });

  it("rejects invalid or incoherent configuration values", () => {
    expect(() => IdentityProviderAccountPolicyConfig.fromEnv({
      IDENTITY_LOCAL_PROVIDER_ENABLED: "maybe",
    })).toThrow("must be a boolean");

    expect(() => IdentityProviderAccountPolicyConfig.fromEnv({
      IDENTITY_LOCAL_CREDENTIAL_MIN_LENGTH: "7",
    })).toThrow("integer >= 8");

    expect(() => new IdentityProviderAccountPolicyConfig({
      localProviderEnabled: false,
      allowLocalRegistration: true,
    })).toThrow("allowLocalRegistration requires localProviderEnabled");

    expect(() => IdentityProviderAccountPolicyConfig.fromEnv({
      IDENTITY_LOCAL_CREDENTIAL_MAX_LENGTH: "4",
      IDENTITY_LOCAL_CREDENTIAL_MIN_LENGTH: "12",
    })).toThrow("maxLength must be an integer >= minLength");
  });
});
