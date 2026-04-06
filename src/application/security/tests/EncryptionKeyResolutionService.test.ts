import { describe, expect, it } from "bun:test";
import {
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
  createEncryptionAtRestPolicyDefinition,
  type EncryptionAtRestPolicyDefinition,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type {
  EncryptionKeyDescriptor,
  IEncryptionKeyCatalogPort,
  ResolveActiveEncryptionKeyRequest,
  ResolveEncryptionKeyByReferenceRequest,
} from "../ports/EncryptionKeyResolutionPorts";
import { EncryptionPolicyEvaluationService } from "../use-cases/EncryptionPolicyEvaluationService";
import {
  EncryptionKeyResolutionErrorCodes,
  EncryptionMaterialClasses,
} from "../use-cases/EncryptionKeyResolutionServiceContracts";
import { EncryptionKeyResolutionService } from "../use-cases/EncryptionKeyResolutionService";
import type { IEncryptionEnforcementObservabilityPort } from "../ports/EncryptionEnforcementObservabilityPorts";

class InMemoryEncryptionPolicyContextResolver {
  public constructor(
    private readonly policies: {
      readonly platformPolicy: EncryptionAtRestPolicyDefinition;
      readonly workspacePolicy?: EncryptionAtRestPolicyDefinition;
      readonly storageInstancePolicy?: EncryptionAtRestPolicyDefinition;
    },
  ) {}

  public async resolvePolicyContext(request: {
    readonly workspaceId?: string;
    readonly storageInstanceId?: string;
  }) {
    return {
      platformPolicy: this.policies.platformPolicy,
      workspacePolicy: request.workspaceId ? this.policies.workspacePolicy : undefined,
      storageInstancePolicy: request.storageInstanceId ? this.policies.storageInstancePolicy : undefined,
    };
  }
}

class InMemoryEncryptionKeyCatalogPort implements IEncryptionKeyCatalogPort {
  private readonly keysByReference = new Map<string, EncryptionKeyDescriptor>();
  private readonly activeByScopeOwner = new Map<string, EncryptionKeyDescriptor>();

  public constructor(keys: ReadonlyArray<EncryptionKeyDescriptor>) {
    for (const key of keys) {
      this.keysByReference.set(key.keyReferenceId, key);
      this.activeByScopeOwner.set(toScopeOwnerId(key.scopeOwner), key);
    }
  }

  public async resolveActiveKeyForScope(
    request: ResolveActiveEncryptionKeyRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    return this.activeByScopeOwner.get(toScopeOwnerId(request.scopeOwner));
  }

  public async resolveKeyByReference(
    request: ResolveEncryptionKeyByReferenceRequest,
  ): Promise<EncryptionKeyDescriptor | undefined> {
    return this.keysByReference.get(request.keyReferenceId);
  }
}

class CapturingEncryptionObservabilityPort implements IEncryptionEnforcementObservabilityPort {
  public readonly events: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0][] = [];

  public async recordEncryptionEnforcementEvent(
    event: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
  }
}

describe("EncryptionKeyResolutionService", () => {
  it("resolves a storage-instance scoped key using evaluated policy scope", async () => {
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      workspaceAssetMode: EncryptionModes.metadataOnly,
      storageAssetMode: EncryptionModes.scopedContent,
      keys: [
        createKey("key:storage:alpha:primary:v3", EncryptionKeyScopes.storageInstance, {
          workspaceId: "workspace:alpha",
          storageInstanceId: "storage:primary",
        }),
      ],
    });

    const result = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:primary",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        materialClass: EncryptionMaterialClasses.assetContent,
        policyDataClass: ProtectedDataClasses.assetContent,
        keyScope: EncryptionKeyScopes.storageInstance,
        scopeOwner: {
          scope: EncryptionKeyScopes.storageInstance,
          workspaceId: "workspace:alpha",
          storageInstanceId: "storage:primary",
        },
        key: createKey("key:storage:alpha:primary:v3", EncryptionKeyScopes.storageInstance, {
          workspaceId: "workspace:alpha",
          storageInstanceId: "storage:primary",
        }),
        policyResolvedFrom: "storage-instance",
      },
    });
  });

  it("resolves a workspace key and keeps secret/signing materials on always-encrypted key paths", async () => {
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      workspaceAssetMode: EncryptionModes.scopedContent,
      keys: [
        createKey("key:workspace:alpha:v1", EncryptionKeyScopes.workspace, {
          workspaceId: "workspace:alpha",
        }),
        createKey("key:server:baseline:v4", EncryptionKeyScopes.server),
      ],
    });

    const workspaceAsset = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(workspaceAsset.ok).toBeTrue();
    if (!workspaceAsset.ok) {
      return;
    }
    expect(workspaceAsset.value.keyScope).toBe(EncryptionKeyScopes.workspace);
    expect(workspaceAsset.value.key.keyReferenceId).toBe("key:workspace:alpha:v1");

    const secret = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.secretMaterial,
    });
    expect(secret.ok).toBeTrue();
    if (!secret.ok) {
      return;
    }
    expect(secret.value.keyScope).toBe(EncryptionKeyScopes.server);
    expect(secret.value.policyDataClass).toBe(ProtectedDataClasses.secretMaterial);
    expect(secret.value.key.keyReferenceId).toBe("key:server:baseline:v4");

    const signing = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.signingMaterial,
    });
    expect(signing.ok).toBeTrue();
    if (!signing.ok) {
      return;
    }
    expect(signing.value.policyDataClass).toBe(ProtectedDataClasses.secretMaterial);
    expect(signing.value.key.keyReferenceId).toBe("key:server:baseline:v4");
  });

  it("fails closed when content encryption is not required for requested material", async () => {
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      keys: [createKey("key:server:baseline:v4", EncryptionKeyScopes.server)],
    });

    const result = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: EncryptionKeyResolutionErrorCodes.policyViolation,
        message: "Material class 'asset-content' does not resolve to scoped-content key encryption.",
        details: {
          materialClass: EncryptionMaterialClasses.assetContent,
          policyDataClass: ProtectedDataClasses.assetContent,
        },
      },
    });
  });

  it("returns deterministic key-unavailable failures for missing scoped keys", async () => {
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      workspaceAssetMode: EncryptionModes.scopedContent,
      keys: [createKey("key:server:baseline:v4", EncryptionKeyScopes.server)],
    });

    const result = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: EncryptionKeyResolutionErrorCodes.keyUnavailable,
        message: "No active encryption key is configured for scope 'workspace'.",
        details: {
          scopeOwner: {
            scope: EncryptionKeyScopes.workspace,
            workspaceId: "workspace:alpha",
          },
        },
      },
    });
  });

  it("resolves stored key references for decrypt/re-encrypt compatibility", async () => {
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      keys: [createKey("key:server:baseline:v4", EncryptionKeyScopes.server)],
    });

    const found = await service.resolveStoredKeyReference({
      keyReferenceId: "key:server:baseline:v4",
    });
    expect(found.ok).toBeTrue();
    if (!found.ok) {
      return;
    }
    expect(found.value.key.keyReferenceId).toBe("key:server:baseline:v4");

    const missing = await service.resolveStoredKeyReference({
      keyReferenceId: "key:missing",
    });
    expect(missing).toEqual({
      ok: false,
      error: {
        code: EncryptionKeyResolutionErrorCodes.notFound,
        message: "Encryption key reference 'key:missing' was not found.",
        details: undefined,
      },
    });
  });

  it("emits diagnostics for key-scope success and missing-key failures", async () => {
    const observabilityPort = new CapturingEncryptionObservabilityPort();
    const service = createService({
      platformAssetMode: EncryptionModes.none,
      workspaceAssetMode: EncryptionModes.scopedContent,
      keys: [createKey("key:workspace:alpha:v1", EncryptionKeyScopes.workspace, { workspaceId: "workspace:alpha" })],
      observabilityPort,
    });

    const success = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:alpha",
      occurredAt: "2026-04-06T11:00:00.000Z",
    });
    expect(success.ok).toBeTrue();

    const missing = await service.resolveKeyForMaterial({
      materialClass: EncryptionMaterialClasses.assetContent,
      workspaceId: "workspace:beta",
      occurredAt: "2026-04-06T11:05:00.000Z",
    });
    expect(missing.ok).toBeFalse();

    expect(observabilityPort.events.some((event) => (
      event.event === "encryption-key.key-scope-resolved"
      && event.outcome === "succeeded"
    ))).toBeTrue();
    expect(observabilityPort.events.some((event) => (
      event.event === "encryption-key.key-scope-resolved"
      && event.outcome === "missing"
    ))).toBeTrue();
  });
});

function createService(input: {
  readonly platformAssetMode: typeof EncryptionModes[keyof typeof EncryptionModes];
  readonly workspaceAssetMode?: typeof EncryptionModes[keyof typeof EncryptionModes];
  readonly storageAssetMode?: typeof EncryptionModes[keyof typeof EncryptionModes];
  readonly keys: ReadonlyArray<EncryptionKeyDescriptor>;
  readonly observabilityPort?: IEncryptionEnforcementObservabilityPort;
}) {
  const evaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: new InMemoryEncryptionPolicyContextResolver({
      platformPolicy: createPlatformPolicy(input.platformAssetMode),
      workspacePolicy: input.workspaceAssetMode
        ? createWorkspacePolicy(input.workspaceAssetMode)
        : undefined,
      storageInstancePolicy: input.storageAssetMode
        ? createStoragePolicy(input.storageAssetMode)
        : undefined,
    }),
  });

  return new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService: evaluationService,
    encryptionKeyCatalogPort: new InMemoryEncryptionKeyCatalogPort(input.keys),
    observabilityPort: input.observabilityPort,
  });
}

function createKey(
  keyReferenceId: string,
  scope: typeof EncryptionKeyScopes[keyof typeof EncryptionKeyScopes],
  owner?: {
    readonly workspaceId?: string;
    readonly storageInstanceId?: string;
  },
): EncryptionKeyDescriptor {
  return {
    keyReferenceId,
    keyId: keyReferenceId,
    keyVersion: "v1",
    algorithm: "aes-256-gcm",
    scopeOwner: {
      scope,
      workspaceId: owner?.workspaceId,
      storageInstanceId: owner?.storageInstanceId,
    },
    lifecycleState: "active",
    activatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createPlatformPolicy(assetMode: typeof EncryptionModes[keyof typeof EncryptionModes]) {
  return createEncryptionAtRestPolicyDefinition({
    policyId: "policy:platform:default",
    scope: EncryptionPolicyScopes.platform,
    rules: [
      {
        dataClass: ProtectedDataClasses.secretMaterial,
        encryptionMode: EncryptionModes.scopedContent,
        keyScope: EncryptionKeyScopes.server,
      },
      {
        dataClass: ProtectedDataClasses.secretMetadata,
        encryptionMode: EncryptionModes.metadataOnly,
      },
      {
        dataClass: ProtectedDataClasses.sensitiveMetadata,
        encryptionMode: EncryptionModes.metadataOnly,
      },
      {
        dataClass: ProtectedDataClasses.assetContent,
        encryptionMode: assetMode,
        keyScope: assetMode === EncryptionModes.scopedContent ? EncryptionKeyScopes.server : undefined,
      },
    ],
  });
}

function createWorkspacePolicy(assetMode: typeof EncryptionModes[keyof typeof EncryptionModes]) {
  return createEncryptionAtRestPolicyDefinition({
    policyId: "policy:workspace:alpha",
    scope: EncryptionPolicyScopes.workspace,
    workspaceId: "workspace:alpha",
    rules: [{
      dataClass: ProtectedDataClasses.assetContent,
      encryptionMode: assetMode,
      keyScope: assetMode === EncryptionModes.scopedContent ? EncryptionKeyScopes.workspace : undefined,
      decryption: assetMode === EncryptionModes.scopedContent
        ? {
          allowPreview: true,
          allowWorker: true,
        }
        : undefined,
    }],
  });
}

function createStoragePolicy(assetMode: typeof EncryptionModes[keyof typeof EncryptionModes]) {
  return createEncryptionAtRestPolicyDefinition({
    policyId: "policy:storage:alpha:primary",
    scope: EncryptionPolicyScopes.storageInstance,
    workspaceId: "workspace:alpha",
    storageInstanceId: "storage:primary",
    rules: [{
      dataClass: ProtectedDataClasses.assetContent,
      encryptionMode: assetMode,
      keyScope: assetMode === EncryptionModes.scopedContent ? EncryptionKeyScopes.storageInstance : undefined,
      decryption: assetMode === EncryptionModes.scopedContent
        ? {
          allowPreview: true,
          allowWorker: false,
        }
        : undefined,
    }],
  });
}

function toScopeOwnerId(owner: EncryptionKeyDescriptor["scopeOwner"]): string {
  if (owner.scope === EncryptionKeyScopes.server) {
    return owner.scope;
  }
  if (owner.scope === EncryptionKeyScopes.workspace) {
    return `${owner.scope}:${owner.workspaceId}`;
  }
  return `${owner.scope}:${owner.workspaceId}:${owner.storageInstanceId}`;
}

