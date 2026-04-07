import { describe, expect, it } from "bun:test";
import { EncryptionKeyScopes } from "@domain/security/EncryptionAtRestPolicyDomain";
import type { EncryptionKeyDescriptor } from "@application/security/ports/EncryptionKeyResolutionPorts";
import { StaticEncryptionKeyCatalogPort } from "../StaticEncryptionKeyCatalogPort";

describe("StaticEncryptionKeyCatalogPort", () => {
  it("resolves deterministic active keys by scope owner and occurredAt", async () => {
    const catalog = new StaticEncryptionKeyCatalogPort({
      keys: [
        createKey("key:server:v1", EncryptionKeyScopes.server, {
          activatedAt: "2026-01-01T00:00:00.000Z",
        }),
        createKey("key:server:v2", EncryptionKeyScopes.server, {
          activatedAt: "2026-03-01T00:00:00.000Z",
        }),
      ],
    });

    const latest = await catalog.resolveActiveKeyForScope({
      scopeOwner: {
        scope: EncryptionKeyScopes.server,
      },
    });
    expect(latest?.keyReferenceId).toBe("key:server:v2");

    const atDate = await catalog.resolveActiveKeyForScope({
      scopeOwner: {
        scope: EncryptionKeyScopes.server,
      },
      occurredAt: "2026-02-01T00:00:00.000Z",
    });
    expect(atDate?.keyReferenceId).toBe("key:server:v1");
  });

  it("resolves workspace and storage-instance scoped keys", async () => {
    const catalog = new StaticEncryptionKeyCatalogPort({
      keys: [
        createKey("key:workspace:alpha:v1", EncryptionKeyScopes.workspace, {
          workspaceId: "workspace:alpha",
        }),
        createKey("key:storage:alpha:primary:v1", EncryptionKeyScopes.storageInstance, {
          workspaceId: "workspace:alpha",
          storageInstanceId: "storage:primary",
        }),
      ],
    });

    const workspaceKey = await catalog.resolveActiveKeyForScope({
      scopeOwner: {
        scope: EncryptionKeyScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });
    expect(workspaceKey?.keyReferenceId).toBe("key:workspace:alpha:v1");

    const storageKey = await catalog.resolveActiveKeyForScope({
      scopeOwner: {
        scope: EncryptionKeyScopes.storageInstance,
        workspaceId: "workspace:alpha",
        storageInstanceId: "storage:primary",
      },
    });
    expect(storageKey?.keyReferenceId).toBe("key:storage:alpha:primary:v1");
  });

  it("returns undefined when no active key exists for requested scope owner", async () => {
    const catalog = new StaticEncryptionKeyCatalogPort({
      keys: [
        createKey("key:workspace:alpha:retired", EncryptionKeyScopes.workspace, {
          workspaceId: "workspace:alpha",
          lifecycleState: "retired",
        }),
      ],
    });

    const key = await catalog.resolveActiveKeyForScope({
      scopeOwner: {
        scope: EncryptionKeyScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });

    expect(key).toBeUndefined();
  });

  it("resolves key metadata by keyReferenceId regardless of lifecycle state", async () => {
    const catalog = new StaticEncryptionKeyCatalogPort({
      keys: [
        createKey("key:server:v1", EncryptionKeyScopes.server, {
          lifecycleState: "retiring",
        }),
      ],
    });

    const found = await catalog.resolveKeyByReference({
      keyReferenceId: "key:server:v1",
    });
    expect(found?.lifecycleState).toBe("retiring");

    const missing = await catalog.resolveKeyByReference({
      keyReferenceId: "key:missing",
    });
    expect(missing).toBeUndefined();
  });

  it("fails invalid scope ownership metadata early", () => {
    expect(() => new StaticEncryptionKeyCatalogPort({
      keys: [createKey("key:workspace:invalid", EncryptionKeyScopes.workspace)],
    })).toThrow("workspaceId");
  });
});

function createKey(
  keyReferenceId: string,
  scope: typeof EncryptionKeyScopes[keyof typeof EncryptionKeyScopes],
  options?: {
    readonly workspaceId?: string;
    readonly storageInstanceId?: string;
    readonly lifecycleState?: EncryptionKeyDescriptor["lifecycleState"];
    readonly activatedAt?: string;
  },
): EncryptionKeyDescriptor {
  return {
    keyReferenceId,
    keyId: keyReferenceId,
    keyVersion: "v1",
    algorithm: "aes-256-gcm",
    scopeOwner: {
      scope,
      workspaceId: options?.workspaceId,
      storageInstanceId: options?.storageInstanceId,
    },
    lifecycleState: options?.lifecycleState ?? "active",
    activatedAt: options?.activatedAt ?? "2026-01-01T00:00:00.000Z",
    metadata: {
      owner: "security-team",
    },
  };
}


