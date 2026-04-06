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
  readonly includeRevoked?: boolean;
  readonly includeDeleted?: boolean;
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

export interface ISecretRecordPersistenceRepository {
  findSecretById(secretId: string): Promise<SecretRecord | undefined>;
  findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretScopeOwner;
  }): Promise<SecretRecord | undefined>;
  listSecrets(query: SecretListQuery): Promise<ReadonlyArray<SecretReference>>;
  createSecret(input: SecretCreatePersistenceInput): Promise<SecretMutationResult & { readonly record: SecretRecord }>;
  saveSecret(record: SecretRecord, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult & { readonly record: SecretRecord }>;
  deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult>;
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

export interface SecretAccessAuditEvent {
  readonly secretId?: string;
  readonly scope: SecretScope;
  readonly action: SecretAccessAction;
  readonly decision: "allowed" | "denied";
  readonly reason: SecretAccessDecisionReason;
  readonly operationKey?: string;
  readonly serviceIdentity?: string;
  readonly justification?: string;
  readonly actorId: string;
  readonly actorType: SecretAccessActor["actorType"];
  readonly workspaceId?: string;
  readonly userIdentityId?: string;
  readonly occurredAt: string;
}

export interface ISecretAccessAuditPort {
  recordSecretAccessDecision(event: SecretAccessAuditEvent): Promise<void>;
}
