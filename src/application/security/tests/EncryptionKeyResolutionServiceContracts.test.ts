import { describe, expect, it } from "bun:test";
import { EncryptionKeyScopes, ProtectedDataClasses } from "@domain/security/EncryptionAtRestPolicyDomain";
import type { EncryptionKeyDescriptor } from "../ports/EncryptionKeyResolutionPorts";
import type {
  EncryptionKeyResolutionServiceResult,
  IEncryptionKeyResolutionService,
  ResolveStoredEncryptionKeyReference,
  ResolvedEncryptionKeyForMaterial,
} from "../use-cases/EncryptionKeyResolutionServiceContracts";
import { EncryptionMaterialClasses } from "../use-cases/EncryptionKeyResolutionServiceContracts";

class StubEncryptionKeyResolutionService implements IEncryptionKeyResolutionService {
  public async resolveKeyForMaterial(): Promise<
    EncryptionKeyResolutionServiceResult<ResolvedEncryptionKeyForMaterial>
  > {
    return {
      ok: true,
      value: {
        materialClass: EncryptionMaterialClasses.assetContent,
        policyDataClass: ProtectedDataClasses.assetContent,
        keyScope: EncryptionKeyScopes.workspace,
        scopeOwner: {
          scope: EncryptionKeyScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        key: createKey("key:workspace:alpha:v1", EncryptionKeyScopes.workspace, "workspace:alpha"),
        policyResolvedFrom: "workspace",
      },
    };
  }

  public async resolveStoredKeyReference(): Promise<
    EncryptionKeyResolutionServiceResult<ResolveStoredEncryptionKeyReference>
  > {
    return {
      ok: true,
      value: {
        key: createKey("key:server:baseline:v1", EncryptionKeyScopes.server),
      },
    };
  }
}

describe("EncryptionKeyResolutionService contracts", () => {
  it("supports storage, asset, secret, and persisted-material key resolution seams", async () => {
    const resolver: IEncryptionKeyResolutionService = new StubEncryptionKeyResolutionService();

    const storageKey = await resolver.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:primary",
    });
    expect(storageKey.ok).toBeTrue();

    const assetKey = await resolver.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(assetKey.ok).toBeTrue();

    const secretKey = await resolver.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.secretMaterial,
    });
    expect(secretKey.ok).toBeTrue();

    const signingKey = await resolver.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.signingMaterial,
    });
    expect(signingKey.ok).toBeTrue();

    const existing = await resolver.resolveStoredKeyReference({
      keyReferenceId: "key:server:baseline:v1",
    });
    expect(existing.ok).toBeTrue();
  });
});

function createKey(
  keyReferenceId: string,
  scope: typeof EncryptionKeyScopes[keyof typeof EncryptionKeyScopes],
  workspaceId?: string,
): EncryptionKeyDescriptor {
  return {
    keyReferenceId,
    keyId: keyReferenceId,
    keyVersion: "v1",
    algorithm: "aes-256-gcm",
    scopeOwner: {
      scope,
      workspaceId,
    },
    lifecycleState: "active",
    activatedAt: "2026-01-01T00:00:00.000Z",
  };
}


