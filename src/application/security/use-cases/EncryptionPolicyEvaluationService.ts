import {
  EncryptionAtRestPolicyDomainError,
  EncryptionModes,
  ProtectedDataClasses,
  evaluateEncryptionAtRestPolicy,
  type ProtectedDataClass,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import type { IEncryptionAtRestPolicyContextResolverPort } from "../ports/EncryptionAtRestPolicyEvaluationPorts";
import {
  EncryptionPolicyEvaluationErrorCodes,
  type ContentEncryptionRequirementDecision,
  type ContentEncryptionRequirementRequest,
  type EffectiveEncryptionPolicyEvaluation,
  type EffectiveEncryptionPolicyEvaluationRequest,
  type EncryptionPolicyEvaluationServiceResult,
  type IEncryptionPolicyEvaluationService,
  type PreviewDecryptionAllowanceDecision,
  type PreviewDecryptionAllowanceRequest,
  type WorkerDecryptionAllowanceDecision,
  type WorkerDecryptionAllowanceRequest,
} from "./EncryptionPolicyEvaluationServiceContracts";

export interface EncryptionPolicyEvaluationServiceDependencies {
  readonly encryptionAtRestPolicyContextResolverPort: IEncryptionAtRestPolicyContextResolverPort;
}

export class EncryptionPolicyEvaluationService implements IEncryptionPolicyEvaluationService {
  public constructor(private readonly dependencies: EncryptionPolicyEvaluationServiceDependencies) {}

  public async evaluateEffectivePolicy(
    request: EffectiveEncryptionPolicyEvaluationRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<EffectiveEncryptionPolicyEvaluation>> {
    const normalized = normalizeRequest(request);
    if (!normalized.ok) {
      return normalized;
    }

    const context = await this.resolveContext(normalized.value);
    if (!context.ok) {
      return context;
    }

    try {
      const evaluation = evaluateEncryptionAtRestPolicy({
        dataClass: normalized.value.dataClass,
        platformPolicy: context.value.platformPolicy,
        workspacePolicy: context.value.workspacePolicy,
        storageInstancePolicy: context.value.storageInstancePolicy,
      });

      return {
        ok: true,
        value: Object.freeze({
          dataClass: normalized.value.dataClass,
          evaluation,
          effectiveRule: evaluation.effectiveRule,
          resolvedFrom: evaluation.resolvedFrom,
          inheritedFrom: evaluation.inheritedFrom,
          encryptedAtRestRequired: evaluation.encryptedAtRestRequired,
          contentEncryptionRequired: evaluation.effectiveRule.encryptionMode === EncryptionModes.scopedContent,
          keyScope: evaluation.effectiveRule.keyScope,
          allowPreviewDecryption: evaluation.allowPreviewDecryption,
          allowWorkerDecryption: evaluation.allowWorkerDecryption,
        }),
      };
    } catch (error) {
      if (error instanceof EncryptionAtRestPolicyDomainError) {
        return failure("policyViolation", error.message);
      }
      return failure("internal", "Encryption policy evaluation failed.");
    }
  }

  public async evaluateContentEncryptionRequirement(
    request: ContentEncryptionRequirementRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<ContentEncryptionRequirementDecision>> {
    const evaluated = await this.evaluateEffectivePolicy(request);
    if (!evaluated.ok) {
      return evaluated;
    }

    return {
      ok: true,
      value: Object.freeze({
        dataClass: evaluated.value.dataClass,
        required: evaluated.value.contentEncryptionRequired,
        keyScope: evaluated.value.keyScope,
        resolvedFrom: evaluated.value.resolvedFrom,
      }),
    };
  }

  public async evaluatePreviewDecryptionAllowance(
    request: PreviewDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<PreviewDecryptionAllowanceDecision>> {
    const evaluated = await this.evaluateEffectivePolicy(request);
    if (!evaluated.ok) {
      return evaluated;
    }

    return {
      ok: true,
      value: Object.freeze({
        dataClass: evaluated.value.dataClass,
        allowed: evaluated.value.allowPreviewDecryption,
        resolvedFrom: evaluated.value.resolvedFrom,
      }),
    };
  }

  public async evaluateWorkerDecryptionAllowance(
    request: WorkerDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<WorkerDecryptionAllowanceDecision>> {
    const evaluated = await this.evaluateEffectivePolicy(request);
    if (!evaluated.ok) {
      return evaluated;
    }

    return {
      ok: true,
      value: Object.freeze({
        dataClass: evaluated.value.dataClass,
        allowed: evaluated.value.allowWorkerDecryption,
        resolvedFrom: evaluated.value.resolvedFrom,
      }),
    };
  }

  private async resolveContext(
    request: RequiredContextRequest,
  ): Promise<
    EncryptionPolicyEvaluationServiceResult<Awaited<ReturnType<IEncryptionAtRestPolicyContextResolverPort["resolvePolicyContext"]>>>
  > {
    try {
      const context = await this.dependencies.encryptionAtRestPolicyContextResolverPort.resolvePolicyContext({
        workspaceId: request.workspaceId,
        storageInstanceId: request.storageInstanceId,
        occurredAt: request.occurredAt,
      });
      return {
        ok: true,
        value: context,
      };
    } catch (error) {
      if (error instanceof EncryptionAtRestPolicyDomainError) {
        return failure("policyViolation", error.message);
      }

      if (error instanceof Error && error.message.trim()) {
        return failure("resolutionFailed", error.message.trim());
      }

      return failure("resolutionFailed", "Encryption policy context resolution failed.");
    }
  }
}

type RequiredContextRequest = {
  readonly dataClass: ProtectedDataClass;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
};

function normalizeRequest(
  request: EffectiveEncryptionPolicyEvaluationRequest,
): EncryptionPolicyEvaluationServiceResult<RequiredContextRequest> {
  if (!request) {
    return failure("invalidRequest", "Encryption policy evaluation request is required.");
  }

  const workspaceId = normalizeOptional(request.workspaceId);
  const storageInstanceId = normalizeOptional(request.storageInstanceId);
  const occurredAt = normalizeTimestamp(request.occurredAt);
  if (request.occurredAt && !occurredAt) {
    return failure("invalidRequest", "occurredAt must be a valid timestamp when provided.");
  }

  if (storageInstanceId && !workspaceId) {
    return failure(
      "invalidRequest",
      "workspaceId is required when storageInstanceId is provided.",
    );
  }

  if (!Object.values(ProtectedDataClasses).includes(request.dataClass)) {
    return failure("invalidRequest", `Protected data class '${String(request.dataClass)}' is invalid.`);
  }

  return {
    ok: true,
    value: Object.freeze({
      dataClass: request.dataClass,
      workspaceId,
      storageInstanceId,
      occurredAt,
    }),
  };
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
  code: keyof typeof EncryptionPolicyEvaluationErrorCodes,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): EncryptionPolicyEvaluationServiceResult<never> {
  return {
    ok: false,
    error: Object.freeze({
      code: EncryptionPolicyEvaluationErrorCodes[code],
      message,
      details,
    }),
  };
}
