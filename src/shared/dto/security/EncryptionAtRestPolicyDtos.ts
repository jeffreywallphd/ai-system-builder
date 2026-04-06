import type {
  EncryptedMaterialDescriptorDto,
  EncryptionAtRestPolicyDefinitionDto,
  EncryptionPolicyEvaluationResultDto,
  StorageInstanceEncryptionAtRestPolicyDto,
  WorkspaceEncryptionAtRestPolicyDto,
} from "../../contracts/security/EncryptionAtRestPolicyContracts";

export interface UpsertWorkspaceEncryptionAtRestPolicyRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly policy: WorkspaceEncryptionAtRestPolicyDto;
  readonly occurredAt?: string;
}

export interface UpsertWorkspaceEncryptionAtRestPolicyResponseDto {
  readonly policy: WorkspaceEncryptionAtRestPolicyDto;
}

export interface UpsertStorageInstanceEncryptionAtRestPolicyRequestDto {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly storageInstanceId: string;
  readonly operationKey?: string;
  readonly correlationId?: string;
  readonly policy: StorageInstanceEncryptionAtRestPolicyDto;
  readonly occurredAt?: string;
}

export interface UpsertStorageInstanceEncryptionAtRestPolicyResponseDto {
  readonly policy: StorageInstanceEncryptionAtRestPolicyDto;
}

export interface GetEffectiveEncryptionAtRestPolicyRequestDto {
  readonly actorUserIdentityId?: string;
  readonly workspaceId: string;
  readonly storageInstanceId?: string;
  readonly dataClass: EncryptionPolicyEvaluationResultDto["dataClass"];
  readonly occurredAt?: string;
}

export interface GetEffectiveEncryptionAtRestPolicyResponseDto {
  readonly evaluation: EncryptionPolicyEvaluationResultDto;
  readonly resolvedPolicy: EncryptionAtRestPolicyDefinitionDto;
}

export interface ValidateEncryptedMaterialDescriptorRequestDto {
  readonly workspaceId: string;
  readonly storageInstanceId?: string;
  readonly descriptor: EncryptedMaterialDescriptorDto;
  readonly expectedDataClass: EncryptedMaterialDescriptorDto["dataClass"];
  readonly occurredAt?: string;
}

export interface ValidateEncryptedMaterialDescriptorResponseDto {
  readonly valid: boolean;
  readonly violations: ReadonlyArray<string>;
}

export function toUpsertWorkspaceEncryptionAtRestPolicyResponseDto(
  policy: WorkspaceEncryptionAtRestPolicyDto,
): UpsertWorkspaceEncryptionAtRestPolicyResponseDto {
  return Object.freeze({ policy });
}

export function toUpsertStorageInstanceEncryptionAtRestPolicyResponseDto(
  policy: StorageInstanceEncryptionAtRestPolicyDto,
): UpsertStorageInstanceEncryptionAtRestPolicyResponseDto {
  return Object.freeze({ policy });
}

export function toGetEffectiveEncryptionAtRestPolicyResponseDto(input: {
  readonly evaluation: EncryptionPolicyEvaluationResultDto;
  readonly resolvedPolicy: EncryptionAtRestPolicyDefinitionDto;
}): GetEffectiveEncryptionAtRestPolicyResponseDto {
  return Object.freeze({
    evaluation: input.evaluation,
    resolvedPolicy: input.resolvedPolicy,
  });
}

export function toValidateEncryptedMaterialDescriptorResponseDto(input: {
  readonly valid: boolean;
  readonly violations?: ReadonlyArray<string>;
}): ValidateEncryptedMaterialDescriptorResponseDto {
  return Object.freeze({
    valid: input.valid,
    violations: input.violations ?? [],
  });
}
