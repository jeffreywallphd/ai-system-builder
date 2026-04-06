import type {
  DecryptionAllowance,
  EncryptedMaterialReference,
  EncryptionAtRestPolicyDefinition,
  EncryptionPolicyEvaluationResult,
  ProtectedDataClass,
  ProtectedDataEncryptionRule,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "../../../domain/security/EncryptionAtRestPolicyDomain";

export class EncryptionAtRestPolicyContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionAtRestPolicyContractError";
  }
}

export const EncryptionAtRestPolicyContractVersions = Object.freeze({
  v1: "encryption-at-rest-policy/v1",
});

export type EncryptionAtRestPolicyContractVersion =
  typeof EncryptionAtRestPolicyContractVersions[keyof typeof EncryptionAtRestPolicyContractVersions];

export interface DecryptionAllowanceDto {
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface ProtectedDataEncryptionRuleDto {
  readonly dataClass: ProtectedDataEncryptionRule["dataClass"];
  readonly encryptionMode: ProtectedDataEncryptionRule["encryptionMode"];
  readonly keyScope?: ProtectedDataEncryptionRule["keyScope"];
  readonly decryption: DecryptionAllowanceDto;
  readonly allowPreviewDecryption: boolean;
  readonly allowWorkerDecryption: boolean;
}

export interface MetadataProtectionConfigurationDto {
  readonly secretMetadata: ProtectedDataEncryptionRuleDto;
  readonly sensitiveMetadata: ProtectedDataEncryptionRuleDto;
}

export interface EncryptionAtRestPolicyDefinitionDto {
  readonly policyId: string;
  readonly scope: EncryptionAtRestPolicyDefinition["scope"];
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly rules: ReadonlyArray<ProtectedDataEncryptionRuleDto>;
}

export interface WorkspaceEncryptionAtRestPolicyDto extends EncryptionAtRestPolicyDefinitionDto {
  readonly scope: typeof EncryptionPolicyScopes.workspace;
  readonly workspaceId: string;
  readonly metadataProtection: MetadataProtectionConfigurationDto;
}

export interface StorageInstanceEncryptionAtRestPolicyDto extends EncryptionAtRestPolicyDefinitionDto {
  readonly scope: typeof EncryptionPolicyScopes.storageInstance;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly metadataProtection: MetadataProtectionConfigurationDto;
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

export interface EncryptedMaterialReferenceDto {
  readonly materialId: string;
  readonly encryptedLocator: string;
  readonly algorithm: string;
  readonly keyReferenceId: string;
  readonly keyScope: EncryptedMaterialReference["keyScope"];
  readonly encryptedAt: string;
  readonly payloadDigestSha256?: string;
}

export interface EncryptedMaterialDescriptorDto {
  readonly contractVersion: EncryptionAtRestPolicyContractVersion;
  readonly dataClass: ProtectedDataClass;
  readonly policyId: string;
  readonly policyScope: EncryptionAtRestPolicyDefinitionDto["scope"];
  readonly workspaceId?: string;
  readonly storageInstanceId?: string;
  readonly reference: EncryptedMaterialReferenceDto;
}

function toDecryptionAllowanceDto(decryption: DecryptionAllowance): DecryptionAllowanceDto {
  return Object.freeze({
    allowPreviewDecryption: decryption.allowPreview,
    allowWorkerDecryption: decryption.allowWorker,
  });
}

function toRuleDto(rule: ProtectedDataEncryptionRule): ProtectedDataEncryptionRuleDto {
  const decryption = toDecryptionAllowanceDto(rule.decryption);
  return Object.freeze({
    dataClass: rule.dataClass,
    encryptionMode: rule.encryptionMode,
    keyScope: rule.keyScope,
    decryption,
    allowPreviewDecryption: decryption.allowPreviewDecryption,
    allowWorkerDecryption: decryption.allowWorkerDecryption,
  });
}

function assertPolicyId(policyId: string): string {
  if (!policyId.trim()) {
    throw new EncryptionAtRestPolicyContractError("Encryption policy DTO requires policyId.");
  }

  return policyId;
}

function ruleForDataClass(
  policy: EncryptionAtRestPolicyDefinitionDto,
  dataClass: ProtectedDataClass,
): ProtectedDataEncryptionRuleDto {
  const rule = policy.rules.find((entry) => entry.dataClass === dataClass);
  if (!rule) {
    throw new EncryptionAtRestPolicyContractError(
      `Encryption policy '${policy.policyId}' must include a '${dataClass}' rule for metadata protection configuration.`,
    );
  }

  return rule;
}

function toMetadataProtectionConfiguration(
  policy: EncryptionAtRestPolicyDefinitionDto,
): MetadataProtectionConfigurationDto {
  return Object.freeze({
    secretMetadata: ruleForDataClass(policy, ProtectedDataClasses.secretMetadata),
    sensitiveMetadata: ruleForDataClass(policy, ProtectedDataClasses.sensitiveMetadata),
  });
}

export function toEncryptionAtRestPolicyDefinitionDto(
  policy: EncryptionAtRestPolicyDefinition,
): EncryptionAtRestPolicyDefinitionDto {
  assertPolicyId(policy.policyId);

  return Object.freeze({
    policyId: policy.policyId,
    scope: policy.scope,
    workspaceId: policy.workspaceId,
    storageInstanceId: policy.storageInstanceId,
    rules: Object.freeze(policy.rules.map((rule) => toRuleDto(rule))),
  });
}

export function toMetadataProtectionConfigurationDto(
  policy: EncryptionAtRestPolicyDefinitionDto,
): MetadataProtectionConfigurationDto {
  return toMetadataProtectionConfiguration(policy);
}

export function toWorkspaceEncryptionAtRestPolicyDto(
  policy: EncryptionAtRestPolicyDefinition,
): WorkspaceEncryptionAtRestPolicyDto {
  const dto = toEncryptionAtRestPolicyDefinitionDto(policy);
  if (dto.scope !== EncryptionPolicyScopes.workspace) {
    throw new EncryptionAtRestPolicyContractError("Workspace encryption policy contract requires scope='workspace'.");
  }

  if (!dto.workspaceId) {
    throw new EncryptionAtRestPolicyContractError("Workspace encryption policy contract requires workspaceId.");
  }

  return Object.freeze({
    ...dto,
    scope: EncryptionPolicyScopes.workspace,
    workspaceId: dto.workspaceId,
    metadataProtection: toMetadataProtectionConfiguration(dto),
  });
}

export function toStorageInstanceEncryptionAtRestPolicyDto(
  policy: EncryptionAtRestPolicyDefinition,
): StorageInstanceEncryptionAtRestPolicyDto {
  const dto = toEncryptionAtRestPolicyDefinitionDto(policy);
  if (dto.scope !== EncryptionPolicyScopes.storageInstance) {
    throw new EncryptionAtRestPolicyContractError(
      "Storage-instance encryption policy contract requires scope='storage-instance'.",
    );
  }

  if (!dto.workspaceId) {
    throw new EncryptionAtRestPolicyContractError("Storage-instance encryption policy contract requires workspaceId.");
  }

  if (!dto.storageInstanceId) {
    throw new EncryptionAtRestPolicyContractError(
      "Storage-instance encryption policy contract requires storageInstanceId.",
    );
  }

  return Object.freeze({
    ...dto,
    scope: EncryptionPolicyScopes.storageInstance,
    workspaceId: dto.workspaceId,
    storageInstanceId: dto.storageInstanceId,
    metadataProtection: toMetadataProtectionConfiguration(dto),
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

export function toEncryptedMaterialReferenceDto(reference: EncryptedMaterialReference): EncryptedMaterialReferenceDto {
  return Object.freeze({
    materialId: reference.materialId,
    encryptedLocator: reference.encryptedLocator,
    algorithm: reference.algorithm,
    keyReferenceId: reference.keyReferenceId,
    keyScope: reference.keyScope,
    encryptedAt: reference.encryptedAt,
    payloadDigestSha256: reference.payloadDigestSha256,
  });
}

export function toEncryptedMaterialDescriptorDto(input: {
  readonly dataClass: ProtectedDataClass;
  readonly policy: EncryptionAtRestPolicyDefinitionDto;
  readonly reference: EncryptedMaterialReference;
}): EncryptedMaterialDescriptorDto {
  assertPolicyId(input.policy.policyId);
  if (
    input.policy.scope === EncryptionPolicyScopes.workspace
    && !input.policy.workspaceId
  ) {
    throw new EncryptionAtRestPolicyContractError(
      "Encrypted material descriptor requires workspaceId when policyScope='workspace'.",
    );
  }

  if (input.policy.scope === EncryptionPolicyScopes.storageInstance) {
    if (!input.policy.workspaceId) {
      throw new EncryptionAtRestPolicyContractError(
        "Encrypted material descriptor requires workspaceId when policyScope='storage-instance'.",
      );
    }

    if (!input.policy.storageInstanceId) {
      throw new EncryptionAtRestPolicyContractError(
        "Encrypted material descriptor requires storageInstanceId when policyScope='storage-instance'.",
      );
    }
  }

  return Object.freeze({
    contractVersion: EncryptionAtRestPolicyContractVersions.v1,
    dataClass: input.dataClass,
    policyId: input.policy.policyId,
    policyScope: input.policy.scope,
    workspaceId: input.policy.workspaceId,
    storageInstanceId: input.policy.storageInstanceId,
    reference: toEncryptedMaterialReferenceDto(input.reference),
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
