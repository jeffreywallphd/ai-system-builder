import type {
  EncryptionKeyScope,
  EncryptionPolicyEvaluationResult,
  EncryptionPolicyEvaluationSource,
  ProtectedDataClass,
  ProtectedDataEncryptionRule,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";

export const EncryptionPolicyEvaluationErrorCodes = Object.freeze({
  invalidRequest: "encryption-policy-invalid-request",
  resolutionFailed: "encryption-policy-resolution-failed",
  policyViolation: "encryption-policy-violation",
  internal: "encryption-policy-internal",
});

export type EncryptionPolicyEvaluationErrorCode =
  typeof EncryptionPolicyEvaluationErrorCodes[keyof typeof EncryptionPolicyEvaluationErrorCodes];

export interface EncryptionPolicyEvaluationError {
  readonly code: EncryptionPolicyEvaluationErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type EncryptionPolicyEvaluationServiceResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: EncryptionPolicyEvaluationError;
  };

export interface EffectiveEncryptionPolicyEvaluationRequest {
  readonly dataClass: ProtectedDataClass;
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly occurredAt?: string;
}

export interface EffectiveEncryptionPolicyEvaluation {
  readonly dataClass: ProtectedDataClass;
  readonly evaluation: EncryptionPolicyEvaluationResult;
  readonly effectiveRule: ProtectedDataEncryptionRule;
  readonly resolvedFrom: EncryptionPolicyEvaluationSource;
  readonly inheritedFrom: ReadonlyArray<EncryptionPolicyEvaluationSource>;
  readonly encryptedAtRestRequired: boolean;
  readonly contentEncryptionRequired: boolean;
  readonly keyScope?: EncryptionKeyScope;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface ContentEncryptionRequirementRequest
  extends EffectiveEncryptionPolicyEvaluationRequest {}

export interface ContentEncryptionRequirementDecision {
  readonly dataClass: ProtectedDataClass;
  readonly required: boolean;
  readonly keyScope?: EncryptionKeyScope;
  readonly resolvedFrom: EncryptionPolicyEvaluationSource;
}

export interface PreviewDecryptionAllowanceRequest
  extends EffectiveEncryptionPolicyEvaluationRequest {}

export interface PreviewDecryptionAllowanceDecision {
  readonly dataClass: ProtectedDataClass;
  readonly allowed: boolean;
  readonly resolvedFrom: EncryptionPolicyEvaluationSource;
}

export interface WorkerDecryptionAllowanceRequest
  extends EffectiveEncryptionPolicyEvaluationRequest {}

export interface WorkerDecryptionAllowanceDecision {
  readonly dataClass: ProtectedDataClass;
  readonly allowed: boolean;
  readonly resolvedFrom: EncryptionPolicyEvaluationSource;
}

export interface EncryptionPolicyEvaluationUseCaseContracts {
  evaluateEffectivePolicy(
    request: EffectiveEncryptionPolicyEvaluationRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<EffectiveEncryptionPolicyEvaluation>>;
  evaluateContentEncryptionRequirement(
    request: ContentEncryptionRequirementRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<ContentEncryptionRequirementDecision>>;
  evaluatePreviewDecryptionAllowance(
    request: PreviewDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<PreviewDecryptionAllowanceDecision>>;
  evaluateWorkerDecryptionAllowance(
    request: WorkerDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<WorkerDecryptionAllowanceDecision>>;
}

export interface IEncryptionPolicyEvaluationService extends EncryptionPolicyEvaluationUseCaseContracts {}
