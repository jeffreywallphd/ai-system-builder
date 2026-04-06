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
import {
  publishEncryptionEnforcementEventBestEffort,
  type IEncryptionEnforcementObservabilityPort,
} from "../ports/EncryptionEnforcementObservabilityPorts";

export interface EncryptionPolicyEvaluationServiceDependencies {
  readonly encryptionAtRestPolicyContextResolverPort: IEncryptionAtRestPolicyContextResolverPort;
  readonly observabilityPort?: IEncryptionEnforcementObservabilityPort;
}

export class EncryptionPolicyEvaluationService implements IEncryptionPolicyEvaluationService {
  public constructor(private readonly dependencies: EncryptionPolicyEvaluationServiceDependencies) {}

  public async evaluateEffectivePolicy(
    request: EffectiveEncryptionPolicyEvaluationRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<EffectiveEncryptionPolicyEvaluation>> {
    const normalized = normalizeRequest(request);
    if (!normalized.ok) {
      await this.publishObservabilityEvent({
        event: "encryption-policy.effective-policy-evaluated",
        outcome: "rejected",
        occurredAt: new Date().toISOString(),
        dataClass: request?.dataClass,
        details: Object.freeze({
          errorCode: normalized.error.code,
          reasonCode: "invalid-request",
        }),
      });
      return normalized;
    }

    const context = await this.resolveContext(normalized.value);
    if (!context.ok) {
      await this.publishObservabilityEvent({
        event: "encryption-policy.effective-policy-evaluated",
        outcome: context.error.code === EncryptionPolicyEvaluationErrorCodes.policyViolation ? "denied" : "failed",
        occurredAt: normalized.value.occurredAt ?? new Date().toISOString(),
        workspaceId: normalized.value.workspaceId,
        storageInstanceId: normalized.value.storageInstanceId,
        dataClass: normalized.value.dataClass,
        details: Object.freeze({
          errorCode: context.error.code,
          reasonCode: "context-resolution-failed",
        }),
      });
      return context;
    }

    try {
      const evaluation = evaluateEncryptionAtRestPolicy({
        dataClass: normalized.value.dataClass,
        platformPolicy: context.value.platformPolicy,
        workspacePolicy: context.value.workspacePolicy,
        storageInstancePolicy: context.value.storageInstancePolicy,
      });

      await this.publishObservabilityEvent({
        event: "encryption-policy.effective-policy-evaluated",
        outcome: "succeeded",
        occurredAt: normalized.value.occurredAt ?? new Date().toISOString(),
        workspaceId: normalized.value.workspaceId,
        storageInstanceId: normalized.value.storageInstanceId,
        dataClass: normalized.value.dataClass,
        details: Object.freeze({
          resolvedFrom: evaluation.resolvedFrom,
          inheritedFrom: evaluation.inheritedFrom,
          encryptedAtRestRequired: evaluation.encryptedAtRestRequired,
          contentEncryptionRequired: evaluation.effectiveRule.encryptionMode === EncryptionModes.scopedContent,
          keyScope: evaluation.effectiveRule.keyScope,
          allowPreviewDecryption: evaluation.allowPreviewDecryption,
          allowWorkerDecryption: evaluation.allowWorkerDecryption,
        }),
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
        await this.publishObservabilityEvent({
          event: "encryption-policy.effective-policy-evaluated",
          outcome: "denied",
          occurredAt: normalized.value.occurredAt ?? new Date().toISOString(),
          workspaceId: normalized.value.workspaceId,
          storageInstanceId: normalized.value.storageInstanceId,
          dataClass: normalized.value.dataClass,
          details: Object.freeze({
            errorCode: EncryptionPolicyEvaluationErrorCodes.policyViolation,
            reasonCode: "policy-violation",
          }),
        });
        return failure("policyViolation", error.message);
      }
      await this.publishObservabilityEvent({
        event: "encryption-policy.effective-policy-evaluated",
        outcome: "failed",
        occurredAt: normalized.value.occurredAt ?? new Date().toISOString(),
        workspaceId: normalized.value.workspaceId,
        storageInstanceId: normalized.value.storageInstanceId,
        dataClass: normalized.value.dataClass,
        details: Object.freeze({
          errorCode: EncryptionPolicyEvaluationErrorCodes.internal,
          reasonCode: "unexpected-evaluation-failure",
        }),
      });
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

  private async publishObservabilityEvent(
    event: Parameters<typeof publishEncryptionEnforcementEventBestEffort>[1],
  ): Promise<void> {
    await publishEncryptionEnforcementEventBestEffort(this.dependencies.observabilityPort, event);
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
