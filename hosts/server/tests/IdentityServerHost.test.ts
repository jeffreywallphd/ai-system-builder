import { describe, expect, it } from "bun:test";
import type { AuthProvider, CredentialPolicy } from "../../../src/domain/identity/IdentityDomain";
import { IdentityProviderAccountPolicyConfig } from "../../../infrastructure/config/IdentityProviderAccountPolicyConfig";
import { applyIdentityStartupConfiguration } from "../IdentityServerHost";

class InMemoryIdentityDefaultConfigurationRepository {
  public readonly providers = new Map<string, AuthProvider>();
  public readonly policies = new Map<string, CredentialPolicy>();

  public async saveAuthProvider(provider: AuthProvider): Promise<AuthProvider> {
    this.providers.set(provider.id, provider);
    return provider;
  }

  public async saveCredentialPolicy(policy: CredentialPolicy): Promise<CredentialPolicy> {
    this.policies.set(policy.id, policy);
    return policy;
  }
}

describe("IdentityServerHost", () => {
  it("applies default startup identity configuration", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig();

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("active");
    expect(provider?.displayName).toBe("Local Password");
    expect(credentialPolicy?.minLength).toBe(12);
    expect(credentialPolicy?.maxFailedAttempts).toBe(5);
  });

  it("seeds a disabled local provider and overridden credential policy defaults when configured", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      localProviderEnabled: false,
      allowLocalRegistration: false,
      localCredentialPolicyDefaults: {
        minLength: 16,
        passwordHistoryCount: 20,
        blockedSubstrings: ["admin", "password"],
      },
    });

    await applyIdentityStartupConfiguration(repository, policies);

    const provider = repository.providers.get("provider:local-password");
    const credentialPolicy = repository.policies.get("policy:local-password");
    expect(provider?.status).toBe("disabled");
    expect(credentialPolicy?.minLength).toBe(16);
    expect(credentialPolicy?.passwordHistoryCount).toBe(20);
    expect(credentialPolicy?.blockedSubstrings).toEqual(["admin", "password"]);
  });

  it("does not seed provider or policy records when startup seeding is disabled", async () => {
    const repository = new InMemoryIdentityDefaultConfigurationRepository();
    const policies = new IdentityProviderAccountPolicyConfig({
      bootstrapSeedDefaults: false,
    });

    await applyIdentityStartupConfiguration(repository, policies);

    expect(repository.providers.size).toBe(0);
    expect(repository.policies.size).toBe(0);
  });
});
