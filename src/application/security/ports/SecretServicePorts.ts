import type {
  KeyEncryptionContext,
  SecretAccessDecision,
  SecretAccessDecisionReason,
  SecretAccessAction,
  SecretAccessActor,
  SecretRecord,
  SecretReference,
  SecretScope,
  SecretScopeOwner,
  SecretVersion,
} from "../../../domain/security/SecretDomain";

export interface SecretListQuery {
  readonly scope?: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly includeDisabled?: boolean;
  readonly includeArchived?: boolean;
  readonly includeSoftDeleted?: boolean;
  readonly kinds?: ReadonlyArray<SecretReference["kind"]>;
  readonly tagAnyOf?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SecretCreatePersistenceInput {
  readonly record: SecretRecord;
  readonly mutation: {
    readonly operationKey: string;
    readonly actorId: string;
    readonly occurredAt?: string;
  };
}

export interface SecretMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

export interface SecretConditionalSaveResult extends SecretMutationResult {
  readonly record: SecretRecord;
  readonly conditionMatched: boolean;
}

export interface ISecretRecordPersistenceRepository {
  findSecretById(secretId: string): Promise<SecretRecord | undefined>;
  findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretScopeOwner;
  }): Promise<SecretRecord | undefined>;
  listSecrets(query: SecretListQuery): Promise<ReadonlyArray<SecretReference>>;
  createSecret(input: SecretCreatePersistenceInput): Promise<SecretMutationResult & { readonly record: SecretRecord }>;
  saveSecret(record: SecretRecord, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult & { readonly record: SecretRecord }>;
  saveSecretWhenCurrentVersionMatches?(
    record: SecretRecord,
    mutation: SecretCreatePersistenceInput["mutation"],
    expectedCurrentVersionId: string | undefined,
  ): Promise<SecretConditionalSaveResult>;
  deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult>;
}

export const SecretReEncryptionOperationStates = Object.freeze({
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
});

export type SecretReEncryptionOperationState =
  typeof SecretReEncryptionOperationStates[keyof typeof SecretReEncryptionOperationStates];

export interface SecretReEncryptionTarget {
  readonly secretId: string;
  readonly versionId: string;
}

export interface SecretReEncryptionFailure {
  readonly secretId: string;
  readonly versionId: string;
  readonly reasonCode: string;
  readonly message: string;
  readonly occurredAt: string;
}

export interface SecretReEncryptionOperationRecord {
  readonly operationId: string;
  readonly operationKey: string;
  readonly state: SecretReEncryptionOperationState;
  readonly targets: ReadonlyArray<SecretReEncryptionTarget>;
  readonly currentIndex: number;
  readonly succeededCount: number;
  readonly failedCount: number;
  readonly failures: ReadonlyArray<SecretReEncryptionFailure>;
  readonly startedBy: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly lastErrorCode?: string;
  readonly lastErrorMessage?: string;
  readonly revision: number;
}

export interface ISecretReEncryptionOperationRepository {
  findReEncryptionOperationById(operationId: string): Promise<SecretReEncryptionOperationRecord | undefined>;
  findReEncryptionOperationByOperationKey(operationKey: string): Promise<SecretReEncryptionOperationRecord | undefined>;
  findLatestRunningReEncryptionOperation(): Promise<SecretReEncryptionOperationRecord | undefined>;
  createReEncryptionOperation(
    operation: Omit<SecretReEncryptionOperationRecord, "revision">,
  ): Promise<SecretReEncryptionOperationRecord>;
  saveReEncryptionOperation(
    operation: SecretReEncryptionOperationRecord,
    expectedRevision: number,
  ): Promise<{ readonly updated: boolean; readonly record: SecretReEncryptionOperationRecord }>;
}

export interface SecretEncryptedMaterial {
  readonly encryptedPayloadRef: string;
  readonly payloadDigestSha256: string;
  readonly payloadByteLength: number;
  readonly keyEncryptionContext: KeyEncryptionContext;
}

export interface ISecretEncryptionPort {
  encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretScopeOwner;
    readonly plaintext: string;
    readonly existingContext?: KeyEncryptionContext;
  }): Promise<SecretEncryptedMaterial>;

  decryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly version: SecretVersion;
  }): Promise<{ readonly plaintext: string }>;
}

export interface ISecretAccessPolicyPort {
  evaluateSecretAccess(input: {
    readonly action: SecretAccessAction;
    readonly actor: SecretAccessActor;
    readonly owner: SecretScopeOwner;
    readonly record?: Pick<SecretRecord, "secretId" | "state" | "protectionPolicy">;
    readonly occurredAt?: string;
  }): Promise<SecretAccessDecision>;
}

export const SecretAuditEventKinds = Object.freeze({
  accessDecision: "secret.access-decision",
  operation: "secret.operation",
});

export const SecretAuditOperationStatuses = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  rejected: "rejected",
  failed: "failed",
  conflict: "conflict",
  missing: "missing",
});

export type SecretAuditOperationStatus =
  typeof SecretAuditOperationStatuses[keyof typeof SecretAuditOperationStatuses];

export interface SecretAuditEventActor {
  readonly actorId: string;
  readonly actorType?: SecretAccessActor["actorType"];
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretAuditEventTarget {
  readonly secretId?: string;
  readonly scope?: SecretScope;
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
}

export interface SecretAccessDecisionAuditEvent {
  readonly eventKind: typeof SecretAuditEventKinds.accessDecision;
  readonly action: SecretAccessAction;
  readonly decision: "allowed" | "denied";
  readonly reason: SecretAccessDecisionReason;
  readonly operationKey?: string;
  readonly serviceIdentity?: string;
  readonly justification?: string;
  readonly actor: SecretAuditEventActor;
  readonly target: SecretAuditEventTarget;
  readonly occurredAt: string;
}

export interface SecretOperationAuditEvent {
  readonly eventKind: typeof SecretAuditEventKinds.operation;
  readonly operation: SecretAccessAction;
  readonly status: SecretAuditOperationStatus;
  readonly reasonCode: string;
  readonly operationKey?: string;
  readonly serviceIdentity?: string;
  readonly actor: SecretAuditEventActor;
  readonly target: SecretAuditEventTarget;
  readonly occurredAt: string;
}

export type SecretAccessAuditEvent = SecretAccessDecisionAuditEvent | SecretOperationAuditEvent;

export interface ISecretAccessAuditPort {
  recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void>;
}
