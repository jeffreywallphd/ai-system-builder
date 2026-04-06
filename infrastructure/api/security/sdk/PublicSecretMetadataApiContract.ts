import type { SecretKind, SecretReference, SecretReferenceMetadata, SecretScope } from "../../../../src/domain/security/SecretDomain";
import type { SecretClassificationId } from "../../../../src/shared/contracts/security/SecretClassificationContracts";
import type { SecretRotationInstructionContract } from "../../../../src/shared/contracts/security/SecretTransportContracts";

export const SecretMetadataApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type SecretMetadataApiErrorCode =
  typeof SecretMetadataApiErrorCodes[keyof typeof SecretMetadataApiErrorCodes];

export interface SecretMetadataApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface SecretMetadataApiError {
  readonly code: SecretMetadataApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<SecretMetadataApiValidationError>;
}

export interface SecretMetadataApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: SecretMetadataApiError;
}

export interface SecretMetadataOwnerApiRecord {
  readonly scope: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretMetadataApiRecord {
  readonly secretId: SecretReference["secretId"];
  readonly name: SecretReference["name"];
  readonly scope: SecretReference["scope"];
  readonly workspaceId?: SecretReference["workspaceId"];
  readonly userIdentityId?: SecretReference["userIdentityId"];
  readonly kind: SecretReference["kind"];
  readonly state: SecretReference["state"];
  readonly currentVersionId?: SecretReference["currentVersionId"];
  readonly metadata: SecretReferenceMetadata;
  readonly updatedAt: SecretReference["updatedAt"];
}

export interface CreateSecretMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly operationKey?: string;
  readonly secretId: string;
  readonly name: string;
  readonly owner: SecretMetadataOwnerApiRecord;
  readonly kind: SecretKind;
  readonly plaintext: string;
  readonly metadata?: SecretReferenceMetadata;
  readonly classificationId?: SecretClassificationId;
  readonly rotationInstruction?: SecretRotationInstructionContract;
  readonly createdAt?: string;
}

export interface CreateSecretMetadataApiResponse {
  readonly secret: SecretMetadataApiRecord;
}

export interface ListSecretMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly owner: SecretMetadataOwnerApiRecord;
  readonly kinds?: ReadonlyArray<SecretKind>;
  readonly tagAnyOf?: ReadonlyArray<string>;
  readonly includeDisabled?: boolean;
  readonly includeArchived?: boolean;
  readonly includeSoftDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListSecretMetadataApiResponse {
  readonly items: ReadonlyArray<SecretMetadataApiRecord>;
}

export interface GetSecretMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly secretId: string;
  readonly occurredAt?: string;
}

export interface GetSecretMetadataApiResponse {
  readonly secret: SecretMetadataApiRecord;
}

export interface DisableSecretMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly operationKey?: string;
  readonly secretId: string;
  readonly disabledAt?: string;
}

export interface DisableSecretMetadataApiResponse {
  readonly secret: SecretMetadataApiRecord;
}
