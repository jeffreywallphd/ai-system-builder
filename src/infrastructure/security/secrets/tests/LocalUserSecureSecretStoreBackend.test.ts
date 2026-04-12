import { describe, expect, it } from "bun:test";
import { SecretKinds, SecretScopes } from "@domain/security/SecretDomain";
import { SecretProviderMaterialKinds } from "@application/security/ports/SecretProviderPorts";
import {
  LocalUserSecureSecretStoreBackend,
  resolveOptionalKeytarCredentialStore,
  type LocalUserSecretCredentialStore,
} from "../LocalUserSecureSecretStoreBackend";

class InMemoryCredentialStore implements LocalUserSecretCredentialStore {
  private readonly values = new Map<string, string>();

  public async getSecret(account: string): Promise<string | undefined> {
    return this.values.get(account);
  }

  public async setSecret(account: string, value: string): Promise<void> {
    this.values.set(account, value);
  }
}

describe("LocalUserSecureSecretStoreBackend", () => {
  it("bootstraps and resolves user-scoped local secure material with metadata and existence checks", async () => {
    const backend = new LocalUserSecureSecretStoreBackend({
      credentialStore: new InMemoryCredentialStore(),
      clock: () => new Date("2026-04-10T00:00:00.000Z"),
    });
    const selector = {
      providerId: "openai",
      secretId: "secret:user:provider:openai",
      scope: {
        scope: SecretScopes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alpha",
      },
      materialKind: SecretProviderMaterialKinds.providerCredential,
    } as const;
    const access = {
      operationKey: "op:test:user-local:bootstrap",
      serviceIdentity: "runtime:user:test",
      usage: "provider-runtime",
      occurredAt: "2026-04-10T00:00:00.000Z",
    } as const;

    const created = await backend.bootstrapUserMaterial({
      selector,
      access,
      name: "provider.openai.local-user-key",
      kind: SecretKinds.apiKey,
      plaintext: "sk-local-v1",
      metadata: {
        tags: ["user", "local"],
        labels: {
          provider: "openai",
        },
      },
    });
    const exists = await backend.userMaterialExists({
      selector,
      access,
    });
    const metadata = await backend.resolveUserMaterialMetadata({
      selector,
      access,
    });
    const resolved = await backend.resolveUserMaterial({
      selector,
      access,
    });
    const existing = await backend.bootstrapUserMaterial({
      selector,
      access: {
        ...access,
        operationKey: "op:test:user-local:existing",
      },
      name: "provider.openai.local-user-key",
      kind: SecretKinds.apiKey,
      plaintext: "sk-local-v1",
    });

    expect(created.ok).toBeTrue();
    if (created.ok) {
      expect(created.value.outcome).toBe("created");
    }
    expect(exists).toEqual({
      ok: true,
      value: {
        exists: true,
      },
    });
    expect(metadata.ok).toBeTrue();
    if (metadata.ok) {
      expect(metadata.value.reference.name).toBe("provider.openai.local-user-key");
      expect(metadata.value.reference.metadata.tags).toEqual(["user", "local"]);
    }
    expect(resolved.ok).toBeTrue();
    if (resolved.ok) {
      expect(resolved.value.rawValue).toBe("sk-local-v1");
      expect(resolved.value.currentVersionId).toContain(":local-");
    }
    expect(existing.ok).toBeTrue();
    if (existing.ok) {
      expect(existing.value.outcome).toBe("existing");
    }
  });

  it("rejects non-user scopes to enforce server/workspace boundaries", async () => {
    const backend = new LocalUserSecureSecretStoreBackend({
      credentialStore: new InMemoryCredentialStore(),
    });

    const serverScopeResult = await backend.resolveUserMaterial({
      selector: {
        providerId: "openai",
        secretId: "secret:server:provider:openai",
        scope: {
          scope: SecretScopes.server,
        },
        materialKind: SecretProviderMaterialKinds.providerCredential,
      },
      access: {
        operationKey: "op:test:server-boundary",
        serviceIdentity: "runtime:server:test",
        usage: "provider-runtime",
      },
    });

    expect(serverScopeResult).toEqual({
      ok: false,
      error: {
        code: "secret-invalid-request",
        message: "Local user secure secret store backend only supports user scope selectors.",
      },
    });
  });

  it("returns keytar availability details without requiring keytar as a hard dependency", () => {
    const resolution = resolveOptionalKeytarCredentialStore({
      serviceName: "ai-loom-studio-test",
    });

    if (resolution.available) {
      expect(resolution.credentialStore).toBeDefined();
      return;
    }

    expect(typeof resolution.reason).toBe("string");
    expect(resolution.reason?.length ?? 0).toBeGreaterThan(0);
  });
});
