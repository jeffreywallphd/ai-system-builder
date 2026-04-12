import { describe, expect, it } from "bun:test";
import {
  resolveCriticalServerSecurityMaterial,
} from "../composition/ResolveCriticalServerSecurityMaterial";
import type { SecurityMaterialStartupValidationResult } from "@application/security/services/SecurityMaterialStartupValidationPipeline";
import {
  SecretServiceErrorCodes,
  type SecretServiceResult,
} from "@application/security/use-cases/SecretManagementServiceContracts";
import type {
  ISecretProviderMaterialResolutionPort,
  ResolveSecretProviderMaterialExistenceInput,
  ResolveSecretProviderMaterialInput,
  ResolveSecretProviderMaterialMetadataInput,
  SecretProviderMaterialBootstrapInput,
  SecretProviderBootstrapResult,
  SecretProviderMaterialMetadata,
  ResolvedSecretProviderMaterialValue,
} from "@application/security/ports/SecretProviderPorts";
import {
  SecretAccessDecisionReasons,
  SecretAccessActions,
  type SecretAccessActor,
  type SecretScopeOwner,
} from "@domain/security/SecretDomain";
import type { ISecretAccessPolicyPort } from "@application/security/ports/SecretServicePorts";
import type { ServerComposedSecretService } from "@infrastructure/security/secrets/SecretServiceComposition";

describe("ResolveCriticalServerSecurityMaterial", () => {
  it("throws when critical material is missing and validation context is unavailable", async () => {
    await expectRejectionMessage(resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:asset-download-grant-secret",
      environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
      materialFormat: "string-secret",
    }), "Critical security material 'material:server:asset-download-grant-secret' is not configured.");
  });

  it("allows deterministic development fallback only when startup validation explicitly permits generated material", async () => {
    const result = await resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({
        NODE_ENV: "development",
      }),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:image-upload-session-token-secret",
      environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
      materialFormat: "string-secret",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:image-upload-session-token-secret",
        lifecycleStage: "development",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });

    expect(result.startsWith("development-only:material:server:image-upload-session-token-secret:")).toBeTrue();
  });

  it("produces deterministic 32-byte base64 values for governed development AES key fallback", async () => {
    const first = await resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:asset-content-encryption-key",
      environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
      inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
      materialFormat: "aes256-base64",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:asset-content-encryption-key",
        lifecycleStage: "test",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });
    const second = await resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:asset-content-encryption-key",
      environmentKey: "AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY",
      inheritedEnvironmentKey: "AI_LOOM_SECRET_MASTER_KEY",
      materialFormat: "aes256-base64",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:asset-content-encryption-key",
        lifecycleStage: "test",
        productionCapable: false,
        sourceKind: "generated-ephemeral",
      }),
    });

    expect(first).toBe(second);
    expect(Buffer.from(first, "base64").length).toBe(32);
  });

  it("rejects generated fallback when startup validation marks the lifecycle as production-capable", async () => {
    await expectRejectionMessage(resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:asset-download-grant-secret",
      environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
      materialFormat: "string-secret",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:asset-download-grant-secret",
        lifecycleStage: "production",
        productionCapable: true,
        sourceKind: "generated-ephemeral",
      }),
    }), "Material is not eligible for governed development fallback in the current lifecycle policy.");
  });

  it("rejects fallback when observation source is not generated-ephemeral", async () => {
    await expectRejectionMessage(resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: createNotFoundProviderResolutionPort(),
      materialId: "material:server:image-upload-session-token-secret",
      environmentKey: "AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET",
      materialFormat: "string-secret",
      startupSecurityMaterialValidation: createValidationResult({
        materialId: "material:server:image-upload-session-token-secret",
        lifecycleStage: "development",
        productionCapable: false,
        sourceKind: "environment",
      }),
    }), "Material is not eligible for governed development fallback in the current lifecycle policy.");
  });

  it("returns provider material when scoped retrieval succeeds", async () => {
    const providerPort = new StubProviderResolutionPort({
      resolveResult: {
        ok: true,
        value: Object.freeze({
          providerId: "platform",
          secretId: "secret:server:asset-download-grant",
          currentVersionId: "v1",
          scope: Object.freeze({ scope: "server" as const }),
          materialKind: "generic",
          rawValue: "provider-backed-material",
        }),
      },
    });

    const resolved = await resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({}),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: providerPort,
      materialId: "material:server:asset-download-grant-secret",
      environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
      materialFormat: "string-secret",
    });

    expect(resolved).toBe("provider-backed-material");
    expect(providerPort.resolveCalls).toBe(1);
  });

  it("falls back to legacy configured material and attempts provider bootstrap when provider material is missing", async () => {
    const providerPort = createNotFoundProviderResolutionPort();

    const resolved = await resolveCriticalServerSecurityMaterial({
      environment: Object.freeze({
        AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET: "legacy-asset-download-grant",
      }),
      secretService: createStubSecretService(),
      secretProviderResolutionPort: providerPort,
      materialId: "material:server:asset-download-grant-secret",
      environmentKey: "AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET",
      materialFormat: "string-secret",
    });

    expect(resolved).toBe("legacy-asset-download-grant");
    expect(providerPort.resolveCalls).toBe(1);
    expect(providerPort.bootstrapCalls).toBe(1);
  });
});

function createValidationResult(input: {
  readonly materialId: string;
  readonly lifecycleStage: "production" | "development" | "test";
  readonly productionCapable: boolean;
  readonly sourceKind: "environment" | "inherited-environment" | "generated-ephemeral" | "missing" | "not-applicable";
}): SecurityMaterialStartupValidationResult {
  return Object.freeze({
    state: "ready",
    lifecycleStage: input.lifecycleStage,
    productionCapable: input.productionCapable,
    observations: Object.freeze([Object.freeze({
      materialId: input.materialId,
      sourceKind: input.sourceKind,
      present: true,
      formatValid: true,
      persistence: "ephemeral",
    })]),
    issues: Object.freeze([]),
    fatalIssues: Object.freeze([]),
    warnings: Object.freeze([]),
  });
}

class AllowAllSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: {
    readonly action: string;
    readonly actor: SecretAccessActor;
    readonly owner: SecretScopeOwner;
    readonly occurredAt?: string;
  }) {
    return Object.freeze({
      allowed: true,
      reason: SecretAccessDecisionReasons.allowed,
      action: input.action as typeof SecretAccessActions[keyof typeof SecretAccessActions],
      actorId: input.actor.actorId,
      scope: input.owner.scope,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      auditEvent: "secret-access-allowed" as const,
    });
  }
}

class StubProviderResolutionPort implements ISecretProviderMaterialResolutionPort {
  public resolveCalls = 0;

  public bootstrapCalls = 0;

  public constructor(private readonly behavior: {
    readonly resolveResult: SecretServiceResult<ResolvedSecretProviderMaterialValue>;
  }) {}

  public async resolveSecretProviderMaterial(
    _input: ResolveSecretProviderMaterialInput,
  ): Promise<SecretServiceResult<ResolvedSecretProviderMaterialValue>> {
    this.resolveCalls += 1;
    return this.behavior.resolveResult;
  }

  public async resolveSecretProviderMaterialMetadata(
    _input: ResolveSecretProviderMaterialMetadataInput,
  ): Promise<SecretServiceResult<SecretProviderMaterialMetadata>> {
    return {
      ok: false,
      error: Object.freeze({
        code: SecretServiceErrorCodes.notFound,
        message: "not found",
      }),
    };
  }

  public async secretProviderMaterialExists(
    _input: ResolveSecretProviderMaterialExistenceInput,
  ): Promise<SecretServiceResult<{ readonly exists: boolean }>> {
    return {
      ok: true,
      value: Object.freeze({
        exists: false,
      }),
    };
  }

  public async bootstrapSecretProviderMaterial(
    _input: SecretProviderMaterialBootstrapInput,
  ): Promise<SecretServiceResult<SecretProviderBootstrapResult>> {
    this.bootstrapCalls += 1;
    return {
      ok: false,
      error: Object.freeze({
        code: SecretServiceErrorCodes.internal,
        message: "bootstrap unavailable in test",
      }),
    };
  }
}

function createNotFoundProviderResolutionPort(): StubProviderResolutionPort {
  return new StubProviderResolutionPort({
    resolveResult: {
      ok: false,
      error: Object.freeze({
        code: SecretServiceErrorCodes.notFound,
        message: "missing",
      }),
    },
  });
}

function createStubSecretService(): ServerComposedSecretService {
  return Object.freeze({
    secretAccessPolicyPort: new AllowAllSecretAccessPolicyPort(),
    createSecretUseCase: undefined,
    getSecretMetadataUseCase: undefined,
    retrieveSecretPlaintextForRuntimeUseCase: undefined,
    rotateSecretUseCase: undefined,
    reEncryptSecretsUseCase: undefined,
    disableSecretUseCase: undefined,
    deleteSecretUseCase: undefined,
    listSecretsUseCase: undefined,
    secretScopeResolver: undefined,
    runtimeSecretConsumptionAdapters: undefined,
    status: Object.freeze({
      configured: false,
      payloadDirectory: "n/a",
    }),
    dispose: () => {},
  } as unknown as ServerComposedSecretService);
}

async function expectRejectionMessage(promise: Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await promise;
  } catch (error) {
    rejected = true;
    const actual = error instanceof Error ? error.message : String(error);
    expect(actual).toContain(message);
  }
  if (!rejected) {
    throw new Error(`Expected promise rejection containing '${message}'.`);
  }
}
