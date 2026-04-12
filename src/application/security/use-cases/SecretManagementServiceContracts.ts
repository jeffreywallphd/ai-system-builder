import type {
  SecretAccessActor,
  SecretKind,
  SecretRecord,
  SecretReference,
  SecretReferenceMetadata,
  SecretScopeOwner,
} from "@domain/security/SecretDomain";

export const SecretServiceErrorCodes = Object.freeze({
  invalidRequest: "secret-invalid-request",
  accessDenied: "secret-access-denied",
  notFound: "secret-not-found",
  conflict: "secret-conflict",
  invalidState: "secret-invalid-state",
  policyViolation: "secret-policy-violation",
  internal: "secret-internal",
});

export type SecretServiceErrorCode = typeof SecretServiceErrorCodes[keyof typeof SecretServiceErrorCodes];

export type SecretServiceResult<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: SecretServiceErrorCode;
      readonly message: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };
  };

export interface CreateSecretRequest {
  readonly actor: SecretAccessActor;
  readonly operationKey: string;
  readonly secretId: string;
  readonly name: string;
  readonly owner: SecretScopeOwner;
  readonly kind: SecretKind;
  readonly plaintext: string;
  readonly metadata?: SecretReferenceMetadata;
  readonly createdAt?: string;
}

export interface CreateSecretResult {
  readonly secret: SecretReference;
}

export interface GetSecretMetadataRequest {
  readonly actor: SecretAccessActor;
  readonly secretId: string;
  readonly occurredAt?: string;
}

export interface RetrieveSecretPlaintextRequest {
  readonly actor: SecretAccessActor;
  readonly secretId: string;
  readonly operationKey: string;
  readonly runtimeContext: {
    readonly serviceIdentity: string;
    readonly scope: SecretScopeOwner;
    readonly justification: string;
    readonly versionId?: string;
    readonly allowSupersededVersion?: boolean;
  };
  readonly occurredAt?: string;
}

export interface RetrieveSecretPlaintextResult {
  readonly secretId: string;
  readonly currentVersionId: string;
  readonly scope: SecretScopeOwner;
  readonly plaintext: string;
}

export interface RotateSecretRequest {
  readonly actor: SecretAccessActor;
  readonly operationKey: string;
  readonly secretId: string;
  readonly plaintext: string;
  readonly expectedCurrentVersionId?: string;
  readonly rotatedAt?: string;
}

export interface RotateSecretResult {
  readonly secret: SecretReference;
  readonly currentVersionId: string;
}

export const SecretReEncryptionOperationStatuses = Object.freeze({
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
});

export type SecretReEncryptionOperationStatus =
  typeof SecretReEncryptionOperationStatuses[keyof typeof SecretReEncryptionOperationStatuses];

export interface ReEncryptSecretsRequest {
  readonly actor: SecretAccessActor;
  readonly operationKey: string;
  readonly operationId?: string;
  readonly maxTargetsPerInvocation?: number;
  readonly occurredAt?: string;
}

export interface ReEncryptSecretsResult {
  readonly operationId: string;
  readonly status: SecretReEncryptionOperationStatus;
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

export interface GetSecretReEncryptionStatusRequest {
  readonly actor: SecretAccessActor;
  readonly operationId: string;
  readonly occurredAt?: string;
}

export interface DisableSecretRequest {
  readonly actor: SecretAccessActor;
  readonly operationKey: string;
  readonly secretId: string;
  readonly disabledAt?: string;
}

export interface DeleteSecretRequest {
  readonly actor: SecretAccessActor;
  readonly operationKey: string;
  readonly secretId: string;
  readonly softDeletedAt?: string;
}

export interface ListSecretsRequest {
  readonly actor: SecretAccessActor;
  readonly owner?: SecretScopeOwner;
  readonly kinds?: ReadonlyArray<SecretKind>;
  readonly tagAnyOf?: ReadonlyArray<string>;
  readonly includeDisabled?: boolean;
  readonly includeArchived?: boolean;
  readonly includeSoftDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListSecretsResult {
  readonly items: ReadonlyArray<SecretReference>;
}

export interface ISecretManagementService {
  createSecret(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>>;
  getSecretMetadata(request: GetSecretMetadataRequest): Promise<SecretServiceResult<SecretReference>>;
  retrieveSecretPlaintextForRuntime(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>>;
  rotateSecret(request: RotateSecretRequest): Promise<SecretServiceResult<RotateSecretResult>>;
  reEncryptSecrets(request: ReEncryptSecretsRequest): Promise<SecretServiceResult<ReEncryptSecretsResult>>;
  getSecretReEncryptionStatus(
    request: GetSecretReEncryptionStatusRequest,
  ): Promise<SecretServiceResult<ReEncryptSecretsResult>>;
  disableSecret(request: DisableSecretRequest): Promise<SecretServiceResult<SecretReference>>;
  deleteSecret(request: DeleteSecretRequest): Promise<SecretServiceResult<{ readonly secretId: string }>>;
  listSecrets(request: ListSecretsRequest): Promise<SecretServiceResult<ListSecretsResult>>;
}

export interface SecretLookupUseCaseContracts {
  getSecretMetadata(request: GetSecretMetadataRequest): Promise<SecretServiceResult<SecretReference>>;
  listSecrets(request: ListSecretsRequest): Promise<SecretServiceResult<ListSecretsResult>>;
}

export interface SecretMutationUseCaseContracts {
  createSecret(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>>;
  rotateSecret(request: RotateSecretRequest): Promise<SecretServiceResult<RotateSecretResult>>;
  reEncryptSecrets(request: ReEncryptSecretsRequest): Promise<SecretServiceResult<ReEncryptSecretsResult>>;
  disableSecret(request: DisableSecretRequest): Promise<SecretServiceResult<SecretReference>>;
  deleteSecret(request: DeleteSecretRequest): Promise<SecretServiceResult<{ readonly secretId: string }>>;
}

export interface SecretRuntimeResolutionUseCaseContracts {
  retrieveSecretPlaintextForRuntime(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>>;
}

export type SecretServiceRecordSnapshot = Pick<
  SecretRecord,
  "secretId" | "state" | "kind" | "owner" | "currentVersionId" | "lastModifiedAt"
>;

