import type {
  SecretKind,
  SecretRecordState,
  SecretReference,
  SecretReferenceMetadata,
  SecretScope,
  SecretScopeOwner,
} from "../../../domain/security/SecretDomain";
import type { SecretClassificationId } from "../../contracts/security/SecretClassificationContracts";
import type { SecretRotationInstructionContract } from "../../contracts/security/SecretTransportContracts";

export interface SecretOwnerCommandDto extends SecretScopeOwner {}

export interface SecretMetadataInputDto {
  readonly displayName?: string;
  readonly description?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly labels?: Readonly<Record<string, string>>;
}

export interface CreateSecretCommandDto {
  readonly operationKey?: string;
  readonly secretId: string;
  readonly name: string;
  readonly owner: SecretOwnerCommandDto;
  readonly kind: SecretKind;
  readonly plaintext: string;
  readonly metadata?: SecretMetadataInputDto;
  readonly classificationId?: SecretClassificationId;
  readonly rotationInstruction?: SecretRotationInstructionContract;
  readonly createdAt?: string;
}

export interface DisableSecretCommandDto {
  readonly secretId: string;
  readonly operationKey?: string;
  readonly disabledAt?: string;
  readonly actorWorkspaceId?: string;
}

export interface RotateSecretCommandDto {
  readonly secretId: string;
  readonly plaintext: string;
  readonly operationKey?: string;
  readonly expectedCurrentVersionId?: string;
  readonly rotatedAt?: string;
  readonly actorWorkspaceId?: string;
}

export interface ReEncryptSecretsCommandDto {
  readonly operationKey?: string;
  readonly operationId?: string;
  readonly maxTargetsPerInvocation?: number;
  readonly occurredAt?: string;
}

export interface GetSecretReEncryptionStatusQueryDto {
  readonly operationId: string;
  readonly occurredAt?: string;
}

export interface GetSecretMetadataQueryDto {
  readonly secretId: string;
  readonly actorWorkspaceId?: string;
  readonly occurredAt?: string;
}

export interface ListSecretMetadataQueryDto {
  readonly owner: SecretOwnerCommandDto;
  readonly actorWorkspaceId?: string;
  readonly kinds?: ReadonlyArray<SecretKind>;
  readonly tagAnyOf?: ReadonlyArray<string>;
  readonly includeDisabled?: boolean;
  readonly includeArchived?: boolean;
  readonly includeSoftDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SecretMetadataQueryDto {
  readonly secretId: SecretReference["secretId"];
  readonly name: SecretReference["name"];
  readonly scope: SecretScope;
  readonly workspaceId?: SecretReference["workspaceId"];
  readonly userIdentityId?: SecretReference["userIdentityId"];
  readonly kind: SecretKind;
  readonly state: SecretRecordState;
  readonly currentVersionId?: SecretReference["currentVersionId"];
  readonly metadata: SecretReferenceMetadata;
  readonly updatedAt: SecretReference["updatedAt"];
}

export function toSecretMetadataQueryDto(reference: SecretReference): SecretMetadataQueryDto {
  return Object.freeze({
    secretId: reference.secretId,
    name: reference.name,
    scope: reference.scope,
    workspaceId: reference.workspaceId,
    userIdentityId: reference.userIdentityId,
    kind: reference.kind,
    state: reference.state,
    currentVersionId: reference.currentVersionId,
    metadata: reference.metadata,
    updatedAt: reference.updatedAt,
  });
}
