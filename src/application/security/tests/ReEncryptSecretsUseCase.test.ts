import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  createSecretRecord,
  evaluateSecretAccessDecision,
  type SecretAccessActor,
  type SecretRecord,
} from "@domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  ISecretReEncryptionOperationRepository,
  SecretAccessAuditEvent,
  SecretConditionalSaveResult,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
  SecretReEncryptionOperationRecord,
} from "../ports/SecretServicePorts";
import { ReEncryptSecretsUseCase } from "../use-cases/ReEncryptSecretsUseCase";

class InMemorySecretRecordRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  public async findSecretByNameAndScope(): Promise<SecretRecord | undefined> {
    return undefined;
  }

  public async listSecrets(_query: SecretListQuery) {
    return Object.freeze([...this.records.values()].map((record) => record.reference));
  }

  public async createSecret(input: SecretCreatePersistenceInput): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(input.record.secretId, input.record);
    return {
      changed: true,
      wasReplay: false,
      record: input.record,
    };
  }

  public async saveSecret(record: SecretRecord): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(record.secretId, record);
    return {
      changed: true,
      wasReplay: false,
      record,
    };
  }

  public async saveSecretWhenCurrentVersionMatches(
    record: SecretRecord,
    _mutation: SecretCreatePersistenceInput["mutation"],
    expectedCurrentVersionId: string | undefined,
  ): Promise<SecretConditionalSaveResult> {
    const existing = this.records.get(record.secretId);
    if (!existing) {
      throw new Error("secret not found");
    }
    if ((existing.currentVersionId ?? undefined) !== (expectedCurrentVersionId ?? undefined)) {
      return {
        changed: false,
        wasReplay: false,
        conditionMatched: false,
        record: existing,
      };
    }
    this.records.set(record.secretId, record);
    return {
      changed: true,
      wasReplay: false,
      conditionMatched: true,
      record,
    };
  }

  public async deleteSecret(): Promise<SecretMutationResult> {
    return {
      changed: false,
      wasReplay: false,
    };
  }
}

class InMemorySecretReEncryptionOperationRepository implements ISecretReEncryptionOperationRepository {
  private readonly operations = new Map<string, SecretReEncryptionOperationRecord>();
  private readonly operationIdByKey = new Map<string, string>();

  public async findReEncryptionOperationById(operationId: string): Promise<SecretReEncryptionOperationRecord | undefined> {
    return this.operations.get(operationId.trim());
  }

  public async findReEncryptionOperationByOperationKey(operationKey: string): Promise<SecretReEncryptionOperationRecord | undefined> {
    const operationId = this.operationIdByKey.get(operationKey.trim());
    return operationId ? this.operations.get(operationId) : undefined;
  }

  public async findLatestRunningReEncryptionOperation(): Promise<SecretReEncryptionOperationRecord | undefined> {
    const running = [...this.operations.values()].filter((operation) => operation.state === "running");
    return running.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).at(-1);
  }

  public async createReEncryptionOperation(
    operation: Omit<SecretReEncryptionOperationRecord, "revision">,
  ): Promise<SecretReEncryptionOperationRecord> {
    const persisted = Object.freeze({
      ...operation,
      revision: 1,
    });
    this.operations.set(persisted.operationId, persisted);
    this.operationIdByKey.set(persisted.operationKey, persisted.operationId);
    return persisted;
  }

  public async saveReEncryptionOperation(
    operation: SecretReEncryptionOperationRecord,
    expectedRevision: number,
  ): Promise<{ readonly updated: boolean; readonly record: SecretReEncryptionOperationRecord }> {
    const current = this.operations.get(operation.operationId);
    if (!current) {
      throw new Error("operation not found");
    }
    if (current.revision !== expectedRevision) {
      return {
        updated: false,
        record: current,
      };
    }
    const persisted = Object.freeze({
      ...operation,
      revision: current.revision + 1,
    });
    this.operations.set(persisted.operationId, persisted);
    this.operationIdByKey.set(persisted.operationKey, persisted.operationId);
    return {
      updated: true,
      record: persisted,
    };
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  private readonly payloadToPlaintext = new Map<string, string>();
  private sequence = 0;
  public activeKeyId = "kek:server:new";
  public throwOnPayloadRef?: string;
  public throwMessage = "simulated decrypt failure";

  public seed(payloadRef: string, plaintext: string): void {
    this.payloadToPlaintext.set(payloadRef, plaintext);
  }

  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretRecord["owner"];
    readonly plaintext: string;
    readonly existingContext?: SecretRecord["versions"][number]["keyEncryptionContext"];
  }) {
    this.sequence += 1;
    const encryptedPayloadRef = `enc:${input.secretId}:reencrypt:${this.sequence}`;
    this.payloadToPlaintext.set(encryptedPayloadRef, input.plaintext);
    return {
      encryptedPayloadRef,
      payloadDigestSha256: `sha256:${input.secretId}:reencrypt:${this.sequence}`,
      payloadByteLength: input.plaintext.length,
      keyEncryptionContext: {
        keyId: this.activeKeyId,
        algorithm: "aes-256-gcm",
        scope: input.owner.scope,
        workspaceId: input.owner.workspaceId,
        userIdentityId: input.owner.userIdentityId,
      },
    };
  }

  public async decryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly version: SecretRecord["versions"][number];
  }): Promise<{ readonly plaintext: string }> {
    if (this.throwOnPayloadRef && input.version.encryptedPayloadRef === this.throwOnPayloadRef) {
      throw new Error(this.throwMessage);
    }
    const plaintext = this.payloadToPlaintext.get(input.version.encryptedPayloadRef);
    if (!plaintext) {
      throw new Error("missing payload");
    }
    return { plaintext };
  }
}

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

class InMemorySecretAccessAuditPort implements ISecretAccessAuditPort {
  public readonly events: SecretAccessAuditEvent[] = [];

  public async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("ReEncryptSecretsUseCase", () => {
  it("re-encrypts active secret versions with the current key and records operation progress", async () => {
    const records = new InMemorySecretRecordRepository();
    const operations = new InMemorySecretReEncryptionOperationRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const useCase = new ReEncryptSecretsUseCase({
      secretRecordRepository: records,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: audit,
      reEncryptionOperationRepository: operations,
    });

    const first = createServerSecretRecord("secret:server:reencrypt-1", "enc:secret:server:reencrypt-1:v1");
    const second = createServerSecretRecord("secret:server:reencrypt-2", "enc:secret:server:reencrypt-2:v1");
    records.seed(first);
    records.seed(second);
    encryption.seed(first.versions[0]?.encryptedPayloadRef ?? "", "sk-1");
    encryption.seed(second.versions[0]?.encryptedPayloadRef ?? "", "sk-2");

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.reEncrypt]),
      operationKey: "op:secret:re-encrypt:full-success",
      maxTargetsPerInvocation: 50,
      occurredAt: "2026-04-06T16:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.status).toBe("succeeded");
    expect(result.value.totalTargets).toBe(2);
    expect(result.value.processedTargets).toBe(2);
    expect(result.value.failedTargets).toBe(0);

    const persistedFirst = await records.findSecretById(first.secretId);
    const persistedSecond = await records.findSecretById(second.secretId);
    expect(persistedFirst?.versions[0]?.keyEncryptionContext.keyId).toBe("kek:server:new");
    expect(persistedSecond?.versions[0]?.keyEncryptionContext.keyId).toBe("kek:server:new");
    expect(audit.events.some((event) => event.eventKind === "secret.operation" && event.operation === "re-encrypt")).toBeTrue();
  });

  it("persists partial progress on failure and can resume the same operation", async () => {
    const records = new InMemorySecretRecordRepository();
    const operations = new InMemorySecretReEncryptionOperationRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const useCase = new ReEncryptSecretsUseCase({
      secretRecordRepository: records,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
      reEncryptionOperationRepository: operations,
    });

    const first = createServerSecretRecord("secret:server:reencrypt-resume-1", "enc:secret:server:reencrypt-resume-1:v1");
    const second = createServerSecretRecord("secret:server:reencrypt-resume-2", "enc:secret:server:reencrypt-resume-2:v1");
    records.seed(first);
    records.seed(second);
    encryption.seed(first.versions[0]?.encryptedPayloadRef ?? "", "sk-first");
    encryption.seed(second.versions[0]?.encryptedPayloadRef ?? "", "sk-second");
    encryption.throwOnPayloadRef = second.versions[0]?.encryptedPayloadRef;

    const failed = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.reEncrypt]),
      operationKey: "op:secret:re-encrypt:resume",
      occurredAt: "2026-04-06T16:30:00.000Z",
    });
    expect(failed.ok).toBeTrue();
    if (!failed.ok) {
      return;
    }
    expect(failed.value.status).toBe("failed");
    expect(failed.value.processedTargets).toBe(1);
    expect(failed.value.remainingTargets).toBe(1);
    expect(failed.value.lastErrorCode).toBe("re-encryption-step-failed");

    encryption.throwOnPayloadRef = undefined;
    const resumed = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.reEncrypt]),
      operationKey: "op:secret:re-encrypt:resume",
      operationId: failed.value.operationId,
      occurredAt: "2026-04-06T16:31:00.000Z",
    });
    expect(resumed.ok).toBeTrue();
    if (!resumed.ok) {
      return;
    }
    expect(resumed.value.status).toBe("succeeded");
    expect(resumed.value.processedTargets).toBe(2);
    expect(resumed.value.remainingTargets).toBe(0);
  });

  it("never persists raw step exception text in operation error status", async () => {
    const records = new InMemorySecretRecordRepository();
    const operations = new InMemorySecretReEncryptionOperationRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const useCase = new ReEncryptSecretsUseCase({
      secretRecordRepository: records,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
      reEncryptionOperationRepository: operations,
    });

    const first = createServerSecretRecord("secret:server:reencrypt-redaction-1", "enc:secret:server:reencrypt-redaction-1:v1");
    const second = createServerSecretRecord("secret:server:reencrypt-redaction-2", "enc:secret:server:reencrypt-redaction-2:v1");
    records.seed(first);
    records.seed(second);
    encryption.seed(first.versions[0]?.encryptedPayloadRef ?? "", "sk-redaction-first");
    encryption.seed(second.versions[0]?.encryptedPayloadRef ?? "", "sk-redaction-second");
    encryption.throwOnPayloadRef = second.versions[0]?.encryptedPayloadRef;
    encryption.throwMessage = "failed while decrypting value sk-live-this-must-not-leak";

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.reEncrypt]),
      operationKey: "op:secret:re-encrypt:redaction",
      occurredAt: "2026-04-06T18:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.status).toBe("failed");
    expect(result.value.lastErrorCode).toBe("re-encryption-step-failed");
    expect(result.value.lastErrorMessage).toBe("Re-encryption step failed.");
    expect(result.value.lastErrorMessage).not.toContain("sk-live-this-must-not-leak");
  });
});

function createServerSecretRecord(secretId: string, payloadRef: string): SecretRecord {
  return createSecretRecord({
    secretId,
    name: `${secretId.replaceAll(":", ".")}.name`,
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    createdBy: "user:server-admin",
    createdAt: "2026-04-06T15:00:00.000Z",
    initialVersion: {
      versionId: `${secretId}:v1`,
      createdBy: "user:server-admin",
      encryptedPayloadRef: payloadRef,
      payloadDigestSha256: `sha256:${secretId}:v1`,
      payloadByteLength: 12,
      keyEncryptionContext: {
        keyId: "kek:server:old",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });
}

function createServerAdminActor(
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return Object.freeze({
    actorId: "user:server-admin",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: actions,
  });
}

