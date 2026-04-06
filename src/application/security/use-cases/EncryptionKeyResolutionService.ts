import {
  EncryptionKeyScopes,
  ProtectedDataClasses,
  type EncryptionKeyScope,
  type ProtectedDataClass,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type { EncryptionKeyScopeOwner, IEncryptionKeyCatalogPort } from "../ports/EncryptionKeyResolutionPorts";
import type { IEncryptionPolicyEvaluationService } from "./EncryptionPolicyEvaluationServiceContracts";
import { EncryptionPolicyEvaluationErrorCodes } from "./EncryptionPolicyEvaluationServiceContracts";
import {
  EncryptionKeyResolutionErrorCodes,
  EncryptionMaterialClasses,
  type EncryptionKeyResolutionServiceResult,
  type IEncryptionKeyResolutionService,
  type ResolveEncryptionKeyForMaterialRequest,
  type ResolveStoredEncryptionKeyReferenceRequest,
  type ResolvedEncryptionKeyForMaterial,
  type ResolveStoredEncryptionKeyReference,
} from "./EncryptionKeyResolutionServiceContracts";

export interface EncryptionKeyResolutionServiceDependencies {
  readonly encryptionPolicyEvaluationService: IEncryptionPolicyEvaluationService;
  readonly encryptionKeyCatalogPort: IEncryptionKeyCatalogPort;
}

export class EncryptionKeyResolutionService implements IEncryptionKeyResolutionService {
  public constructor(private readonly dependencies: EncryptionKeyResolutionServiceDependencies) {}

  public async resolveKeyForMaterial(
    request: ResolveEncryptionKeyForMaterialRequest,
  ): Promise<EncryptionKeyResolutionServiceResult<ResolvedEncryptionKeyForMaterial>> {
    const normalized = normalizeResolveRequest(request);
    if (!normalized.ok) {
      return normalized;
    }

    const policyDataClass = toPolicyDataClass(normalized.value.materialClass);
    const contentDecision = await this.dependencies.encryptionPolicyEvaluationService.evaluateContentEncryptionRequirement({
      dataClass: policyDataClass,
      workspaceId: normalized.value.workspaceId,
      storageInstanceId: normalized.value.storageInstanceId,
      occurredAt: normalized.value.occurredAt,
    });

    if (!contentDecision.ok) {
      return this.mapPolicyFailure(contentDecision.error.code, contentDecision.error.message);
    }

    if (!contentDecision.value.required || !contentDecision.value.keyScope) {
      return failure(
        "policyViolation",
        `Material class '${normalized.value.materialClass}' does not resolve to scoped-content key encryption.`,
        Object.freeze({
          materialClass: normalized.value.materialClass,
          policyDataClass,
        }),
      );
    }

    const scopeOwner = toScopeOwner(contentDecision.value.keyScope, normalized.value);
    if (!scopeOwner) {
      return failure(
        "invalidRequest",
        `Unable to derive key scope owner for '${contentDecision.value.keyScope}'.`,
      );
    }

    try {
      const key = await this.dependencies.encryptionKeyCatalogPort.resolveActiveKeyForScope({
        scopeOwner,
        occurredAt: normalized.value.occurredAt,
      });
      if (!key) {
        return failure(
          "keyUnavailable",
          `No active encryption key is configured for scope '${contentDecision.value.keyScope}'.`,
          Object.freeze({
            scopeOwner,
          }),
        );
      }

      return {
        ok: true,
        value: Object.freeze({
          materialClass: normalized.value.materialClass,
          policyDataClass,
          keyScope: contentDecision.value.keyScope,
          scopeOwner,
          key,
          policyResolvedFrom: contentDecision.value.resolvedFrom,
        }),
      };
    } catch (error) {
      return failure(
        "resolutionFailed",
        toErrorMessage(error, "Encryption key catalog resolution failed."),
      );
    }
  }

  public async resolveStoredKeyReference(
    request: ResolveStoredEncryptionKeyReferenceRequest,
  ): Promise<EncryptionKeyResolutionServiceResult<ResolveStoredEncryptionKeyReference>> {
    const keyReferenceId = normalizeOptional(request?.keyReferenceId);
    if (!keyReferenceId) {
      return failure("invalidRequest", "keyReferenceId is required.");
    }

    try {
      const key = await this.dependencies.encryptionKeyCatalogPort.resolveKeyByReference({
        keyReferenceId,
      });
      if (!key) {
        return failure(
          "notFound",
          `Encryption key reference '${keyReferenceId}' was not found.`,
        );
      }

      return {
        ok: true,
        value: Object.freeze({
          key,
        }),
      };
    } catch (error) {
      return failure(
        "resolutionFailed",
        toErrorMessage(error, "Stored key reference resolution failed."),
      );
    }
  }

  private mapPolicyFailure(
    code: string,
    message: string,
  ): EncryptionKeyResolutionServiceResult<never> {
    if (code === EncryptionPolicyEvaluationErrorCodes.invalidRequest) {
      return failure("invalidRequest", message);
    }
    if (code === EncryptionPolicyEvaluationErrorCodes.policyViolation) {
      return failure("policyViolation", message);
    }
    if (code === EncryptionPolicyEvaluationErrorCodes.resolutionFailed) {
      return failure("resolutionFailed", message);
    }
    if (code === EncryptionPolicyEvaluationErrorCodes.internal) {
      return failure("internal", message);
    }
    return failure("resolutionFailed", message);
  }
}

type NormalizedResolveRequest = {
  readonly materialClass: typeof EncryptionMaterialClasses[keyof typeof EncryptionMaterialClasses];
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
};

function normalizeResolveRequest(
  request: ResolveEncryptionKeyForMaterialRequest,
): EncryptionKeyResolutionServiceResult<NormalizedResolveRequest> {
  if (!request) {
    return failure("invalidRequest", "Encryption key resolution request is required.");
  }

  if (!Object.values(EncryptionMaterialClasses).includes(request.materialClass)) {
    return failure(
      "invalidRequest",
      `Encryption material class '${String(request.materialClass)}' is invalid.`,
    );
  }

  const workspaceId = normalizeOptional(request.workspaceId);
  const storageInstanceId = normalizeOptional(request.storageInstanceId);
  const occurredAt = normalizeTimestamp(request.occurredAt);
  if (request.occurredAt && !occurredAt) {
    return failure("invalidRequest", "occurredAt must be a valid timestamp when provided.");
  }

  if (storageInstanceId && !workspaceId) {
    return failure("invalidRequest", "workspaceId is required when storageInstanceId is provided.");
  }

  return {
    ok: true,
    value: Object.freeze({
      materialClass: request.materialClass,
      workspaceId,
      storageInstanceId,
      occurredAt,
    }),
  };
}

function toPolicyDataClass(
  materialClass: typeof EncryptionMaterialClasses[keyof typeof EncryptionMaterialClasses],
): ProtectedDataClass {
  if (materialClass === EncryptionMaterialClasses.signingMaterial) {
    return ProtectedDataClasses.secretMaterial;
  }
  if (materialClass === EncryptionMaterialClasses.secretMaterial) {
    return ProtectedDataClasses.secretMaterial;
  }
  if (materialClass === EncryptionMaterialClasses.secretMetadata) {
    return ProtectedDataClasses.secretMetadata;
  }
  if (materialClass === EncryptionMaterialClasses.sensitiveMetadata) {
    return ProtectedDataClasses.sensitiveMetadata;
  }
  return ProtectedDataClasses.assetContent;
}

function toScopeOwner(scope: EncryptionKeyScope, request: NormalizedResolveRequest): EncryptionKeyScopeOwner | undefined {
  if (scope === EncryptionKeyScopes.server) {
    return Object.freeze({
      scope,
    });
  }

  if (scope === EncryptionKeyScopes.workspace) {
    if (!request.workspaceId) {
      return undefined;
    }
    return Object.freeze({
      scope,
      workspaceId: request.workspaceId,
    });
  }

  if (!request.workspaceId || !request.storageInstanceId) {
    return undefined;
  }

  return Object.freeze({
    scope,
    workspaceId: request.workspaceId,
    storageInstanceId: request.storageInstanceId,
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function failure(
  code: keyof typeof EncryptionKeyResolutionErrorCodes,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): EncryptionKeyResolutionServiceResult<never> {
  return {
    ok: false,
    error: Object.freeze({
      code: EncryptionKeyResolutionErrorCodes[code],
      message,
      details,
    }),
  };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}
