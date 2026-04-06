import type {
  EncryptionAtRestPolicyDefinition,
  EncryptionPolicyEvaluationResult,
  ProtectedDataEncryptionRule,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";

export class EncryptionAtRestPolicyContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionAtRestPolicyContractError";
  }
}

export interface ProtectedDataEncryptionRuleDto {
  readonly dataClass: ProtectedDataEncryptionRule["dataClass"];
  readonly encryptionMode: ProtectedDataEncryptionRule["encryptionMode"];
  readonly keyScope?: ProtectedDataEncryptionRule["keyScope"];
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface EncryptionAtRestPolicyDefinitionDto {
  readonly policyId: string;
  readonly scope: EncryptionAtRestPolicyDefinition["scope"];
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly rules: ReadonlyArray<ProtectedDataEncryptionRuleDto>;
}

export interface EncryptionPolicyEvaluationResultDto {
  readonly dataClass: EncryptionPolicyEvaluationResult["dataClass"];
  readonly resolvedFrom: EncryptionPolicyEvaluationResult["resolvedFrom"];
  readonly inheritedFrom: ReadonlyArray<EncryptionPolicyEvaluationResult["inheritedFrom"][number]>;
  readonly encryptedAtRestRequired: boolean;
  readonly requiresScopedContentKey: boolean;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
  readonly effectiveRule: ProtectedDataEncryptionRuleDto;
}

function toRuleDto(rule: ProtectedDataEncryptionRule): ProtectedDataEncryptionRuleDto {
  return Object.freeze({
    dataClass: rule.dataClass,
    encryptionMode: rule.encryptionMode,
    keyScope: rule.keyScope,
    allowPreviewDecryption: rule.decryption.allowPreview,
    allowWorkerDecryption: rule.decryption.allowWorker,
  });
}

export function toEncryptionAtRestPolicyDefinitionDto(
  policy: EncryptionAtRestPolicyDefinition,
): EncryptionAtRestPolicyDefinitionDto {
  if (!policy.policyId.trim()) {
    throw new EncryptionAtRestPolicyContractError("Encryption policy DTO requires policyId.");
  }

  return Object.freeze({
    policyId: policy.policyId,
    scope: policy.scope,
    workspaceId: policy.workspaceId,
    storageInstanceId: policy.storageInstanceId,
    rules: Object.freeze(policy.rules.map((rule) => toRuleDto(rule))),
  });
}

export function toEncryptionPolicyEvaluationResultDto(
  evaluation: EncryptionPolicyEvaluationResult,
): EncryptionPolicyEvaluationResultDto {
  return Object.freeze({
    dataClass: evaluation.dataClass,
    resolvedFrom: evaluation.resolvedFrom,
    inheritedFrom: evaluation.inheritedFrom,
    encryptedAtRestRequired: evaluation.encryptedAtRestRequired,
    requiresScopedContentKey: evaluation.requiresScopedContentKey,
    allowPreviewDecryption: evaluation.allowPreviewDecryption,
    allowWorkerDecryption: evaluation.allowWorkerDecryption,
    effectiveRule: toRuleDto(evaluation.effectiveRule),
  });
}

export interface EncryptionPolicyRegistrySnapshot {
  readonly version: number;
  readonly policies: ReadonlyArray<EncryptionAtRestPolicyDefinitionDto>;
}

export function toEncryptionPolicyRegistrySnapshot(
  policies: ReadonlyArray<EncryptionAtRestPolicyDefinition>,
): EncryptionPolicyRegistrySnapshot {
  return Object.freeze({
    version: 1,
    policies: Object.freeze(policies.map((policy) => toEncryptionAtRestPolicyDefinitionDto(policy))),
  });
}

export function serializeEncryptionPolicyRegistry(
  policies: ReadonlyArray<EncryptionAtRestPolicyDefinition>,
): string {
  return JSON.stringify(toEncryptionPolicyRegistrySnapshot(policies));
}
