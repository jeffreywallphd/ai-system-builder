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
  IEncryptionAtRestPolicyContextResolverPort,
  ResolveEncryptionAtRestPolicyContextRequest,
} from "../ports/EncryptionAtRestPolicyEvaluationPorts";
import { EncryptionPolicyEvaluationService } from "../use-cases/EncryptionPolicyEvaluationService";
import { EncryptionPolicyEvaluationErrorCodes } from "../use-cases/EncryptionPolicyEvaluationServiceContracts";

class InMemoryEncryptionPolicyContextResolver implements IEncryptionAtRestPolicyContextResolverPort {
  public constructor(
    private readonly policies: {
      readonly platformPolicy: EncryptionAtRestPolicyDefinition;
      readonly workspacePolicy?: EncryptionAtRestPolicyDefinition;
      readonly storageInstancePolicy?: EncryptionAtRestPolicyDefinition;
    },
  ) {}

  public async resolvePolicyContext(
    request: ResolveEncryptionAtRestPolicyContextRequest,
  ) {
    return {
      platformPolicy: this.policies.platformPolicy,
      workspacePolicy: request.workspaceId ? this.policies.workspacePolicy : undefined,
      storageInstancePolicy: request.storageInstanceId ? this.policies.storageInstancePolicy : undefined,
    };
  }
}

class ThrowingEncryptionPolicyContextResolver implements IEncryptionAtRestPolicyContextResolverPort {
  public constructor(private readonly error: Error) {}

  public async resolvePolicyContext(): Promise<never> {
    throw this.error;
  }
}

describe("EncryptionPolicyEvaluationService", () => {
  it("evaluates effective policy for storage-scoped asset-content decisions", async () => {
    const service = new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: new InMemoryEncryptionPolicyContextResolver({
        platformPolicy: createPlatformPolicy(EncryptionModes.none),
        workspacePolicy: createWorkspacePolicy(EncryptionModes.metadataOnly),
        storageInstancePolicy: createStoragePolicy(EncryptionModes.scopedContent),
      }),
    });

    const effective = await service.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
      storageInstanceId: "storage:primary",
      occurredAt: "2026-04-06T10:15:00.000Z",
    });

    expect(effective.ok).toBeTrue();
    if (!effective.ok) {
      return;
    }

    expect(effective.value.contentEncryptionRequired).toBeTrue();
    expect(effective.value.keyScope).toBe(EncryptionKeyScopes.storageInstance);
    expect(effective.value.allowPreviewDecryption).toBeTrue();
    expect(effective.value.allowWorkerDecryption).toBeFalse();
    expect(effective.value.resolvedFrom).toBe("storage-instance");
    expect(effective.value.inheritedFrom).toEqual(["platform", "workspace"]);
  });

  it("returns focused decision models for content, preview, and worker policy questions", async () => {
    const service = new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: new InMemoryEncryptionPolicyContextResolver({
        platformPolicy: createPlatformPolicy(EncryptionModes.none),
        workspacePolicy: createWorkspacePolicy(EncryptionModes.scopedContent),
      }),
    });

    const content = await service.evaluateContentEncryptionRequirement({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(content).toEqual({
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        required: true,
        keyScope: EncryptionKeyScopes.workspace,
        resolvedFrom: "workspace",
      },
    });

    const preview = await service.evaluatePreviewDecryptionAllowance({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(preview).toEqual({
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        allowed: true,
        resolvedFrom: "workspace",
      },
    });

    const worker = await service.evaluateWorkerDecryptionAllowance({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });
    expect(worker).toEqual({
      ok: true,
      value: {
        dataClass: ProtectedDataClasses.assetContent,
        allowed: true,
        resolvedFrom: "workspace",
      },
    });
  });

  it("fails invalid scope combinations before policy resolution", async () => {
    const service = new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: new InMemoryEncryptionPolicyContextResolver({
        platformPolicy: createPlatformPolicy(EncryptionModes.none),
      }),
    });

    const invalid = await service.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.assetContent,
      storageInstanceId: "storage:orphan",
    });

    expect(invalid).toEqual({
      ok: false,
      error: {
        code: EncryptionPolicyEvaluationErrorCodes.invalidRequest,
        message: "workspaceId is required when storageInstanceId is provided.",
        details: undefined,
      },
    });
  });

  it("surfaces policy-violation outcomes when domain invariants reject weakening overrides", async () => {
    const service = new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: new InMemoryEncryptionPolicyContextResolver({
        platformPolicy: createPlatformPolicy(EncryptionModes.scopedContent),
        workspacePolicy: createWorkspacePolicy(EncryptionModes.metadataOnly),
      }),
    });

    const outcome = await service.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.assetContent,
      workspaceId: "workspace:alpha",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(EncryptionPolicyEvaluationErrorCodes.policyViolation);
  });

  it("surfaces context resolution failures with stable error contracts", async () => {
    const service = new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: new ThrowingEncryptionPolicyContextResolver(
        new Error("resolver unavailable"),
      ),
    });

    const outcome = await service.evaluateEffectivePolicy({
      dataClass: ProtectedDataClasses.secretMetadata,
    });

    expect(outcome).toEqual({
      ok: false,
      error: {
        code: EncryptionPolicyEvaluationErrorCodes.resolutionFailed,
        message: "resolver unavailable",
        details: undefined,
      },
    });
  });
});

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
        keyScope: assetMode === EncryptionModes.scopedContent ? EncryptionKeyScopes.workspace : undefined,
      },
    ],
  });
}

function createWorkspacePolicy(assetMode: typeof EncryptionModes[keyof typeof EncryptionModes]) {
  return createEncryptionAtRestPolicyDefinition({
    policyId: "policy:workspace:alpha",
    scope: EncryptionPolicyScopes.workspace,
    workspaceId: "workspace:alpha",
    rules: [
      {
        dataClass: ProtectedDataClasses.assetContent,
        encryptionMode: assetMode,
        keyScope: assetMode === EncryptionModes.scopedContent ? EncryptionKeyScopes.workspace : undefined,
        decryption: assetMode === EncryptionModes.scopedContent
          ? {
            allowPreview: true,
            allowWorker: true,
          }
          : undefined,
      },
    ],
  });
}

function createStoragePolicy(assetMode: typeof EncryptionModes[keyof typeof EncryptionModes]) {
  return createEncryptionAtRestPolicyDefinition({
    policyId: "policy:storage:alpha:primary",
    scope: EncryptionPolicyScopes.storageInstance,
    workspaceId: "workspace:alpha",
    storageInstanceId: "storage:primary",
    rules: [
      {
        dataClass: ProtectedDataClasses.assetContent,
        encryptionMode: assetMode,
        keyScope: assetMode === EncryptionModes.scopedContent
          ? EncryptionKeyScopes.storageInstance
          : undefined,
        decryption: assetMode === EncryptionModes.scopedContent
          ? {
            allowPreview: true,
            allowWorker: false,
          }
          : undefined,
      },
    ],
  });
}
