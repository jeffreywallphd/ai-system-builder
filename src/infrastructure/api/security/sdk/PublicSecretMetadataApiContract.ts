import type { SecretKind, SecretReference, SecretReferenceMetadata, SecretScope } from "../../../../domain/security/SecretDomain";
import type { SecretClassificationId } from "../../../../shared/contracts/security/SecretClassificationContracts";
import type { SecretRotationInstructionContract } from "../../../../shared/contracts/security/SecretTransportContracts";
import type {
  SecretServiceHealthViewDto,
  SecretServiceOperationalDiagnosticsViewDto,
} from "../../../../shared/dto/security/SecretServiceOperationalDiagnosticsDtos";

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

export interface RotateSecretMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly actorWorkspaceId?: string;
  readonly operationKey?: string;
  readonly secretId: string;
  readonly plaintext: string;
  readonly expectedCurrentVersionId?: string;
  readonly rotatedAt?: string;
}

export interface RotateSecretMetadataApiResponse {
  readonly secret: SecretMetadataApiRecord;
}

export interface ReEncryptSecretsMetadataApiRequest {
  readonly actorUserIdentityId: string;
  readonly operationKey?: string;
  readonly operationId?: string;
  readonly maxTargetsPerInvocation?: number;
  readonly occurredAt?: string;
}

export interface SecretReEncryptionOperationApiRecord {
  readonly operationId: string;
  readonly status: "running" | "succeeded" | "failed";
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly totalTargets: number;
  readonly processedTargets: number;
  readonly succeededTargets: number;
  readonly failedTargets: number;
  readonly remainingTargets: number;
  readonly failures: ReadonlyArray<{
    readonly secretId: string;
    readonly versionId: string;
    readonly reasonCode: string;
    readonly message: string;
    readonly occurredAt: string;
  }>;
  readonly lastErrorCode?: string;
  readonly lastErrorMessage?: string;
}

export interface ReEncryptSecretsMetadataApiResponse {
  readonly operation: SecretReEncryptionOperationApiRecord;
}

export interface GetSecretReEncryptionStatusApiRequest {
  readonly actorUserIdentityId: string;
  readonly operationId: string;
  readonly occurredAt?: string;
}

export interface GetSecretReEncryptionStatusApiResponse {
  readonly operation: SecretReEncryptionOperationApiRecord;
}

export interface GetSecretServiceHealthApiRequest {
  readonly actorUserIdentityId: string;
}

export interface GetSecretServiceHealthApiResponse {
  readonly health: SecretServiceHealthViewDto;
}

export interface GetSecretServiceDiagnosticsApiRequest {
  readonly actorUserIdentityId: string;
}

export interface GetSecretServiceDiagnosticsApiResponse {
  readonly diagnostics: SecretServiceOperationalDiagnosticsViewDto;
}
