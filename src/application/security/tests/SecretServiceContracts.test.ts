import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretRecordStates,
  SecretScopes,
  createSecretRecord,
  softDeleteSecretRecord,
  disableSecretRecord,
  evaluateSecretAccessDecision,
  rotateSecretRecord,
  toSecretReference,
  type SecretAccessActor,
  type SecretRecord,
  type SecretReference,
} from "@domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  SecretAccessAuditEvent,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
} from "../ports/SecretServicePorts";
import {
  SecretServiceErrorCodes,
  type CreateSecretRequest,
  type CreateSecretResult,
  type DeleteSecretRequest,
  type DisableSecretRequest,
  type GetSecretMetadataRequest,
  type ISecretManagementService,
  type ListSecretsRequest,
  type ListSecretsResult,
  type RetrieveSecretPlaintextRequest,
  type RetrieveSecretPlaintextResult,
  type RotateSecretRequest,
  type RotateSecretResult,
  type SecretServiceResult,
} from "../use-cases/SecretManagementServiceContracts";

class InMemorySecretPersistenceRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();
  private readonly replayByOperation = new Map<string, SecretMutationResult & { readonly record?: SecretRecord }>();

  async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  async findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    const name = input.name.trim().toLowerCase();
    for (const record of this.records.values()) {
      if (
        record.reference.name === name
        && record.owner.scope === input.owner.scope
        && record.owner.workspaceId === input.owner.workspaceId
        && record.owner.userIdentityId === input.owner.userIdentityId
      ) {
        return record;
      }
    }
    return undefined;
  }

  async listSecrets(query: SecretListQuery): Promise<readonly SecretReference[]> {
    const includeDisabled = query.includeDisabled ?? false;
    const includeArchived = query.includeArchived ?? false;
    const includeSoftDeleted = query.includeSoftDeleted ?? false;
    const filtered = [...this.records.values()].filter((record) => {
      if (query.scope && record.owner.scope !== query.scope) {
        return false;
      }
      if (query.workspaceId && record.owner.workspaceId !== query.workspaceId) {
        return false;
      }
      if (query.userIdentityId && record.owner.userIdentityId !== query.userIdentityId) {
        return false;
      }
      if (query.kinds && query.kinds.length > 0 && !query.kinds.includes(record.kind)) {
        return false;
      }
      if (!includeDisabled && record.state === SecretRecordStates.disabled) {
        return false;
      }
      if (!includeArchived && record.state === SecretRecordStates.archived) {
        return false;
      }
      if (!includeSoftDeleted && record.state === SecretRecordStates.softDeleted) {
        return false;
      }
      if (query.tagAnyOf && query.tagAnyOf.length > 0) {
        const tags = new Set(record.reference.metadata.tags);
        if (!query.tagAnyOf.some((tag) => tags.has(tag.trim().toLowerCase()))) {
          return false;
        }
      }
      return true;
    }).map((record) => toSecretReference(record));

    const offset = query.offset && query.offset > 0 ? query.offset : 0;
    const limit = query.limit && query.limit > 0 ? query.limit : undefined;
    const paged = offset > 0 ? filtered.slice(offset) : filtered;
    return limit ? paged.slice(0, limit) : paged;
  }

  async createSecret(input: SecretCreatePersistenceInput): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    const replay = this.replayByOperation.get(input.mutation.operationKey);
    if (replay?.record) {
      return {
        changed: false,
        wasReplay: true,
        record: replay.record,
      };
    }

    this.records.set(input.record.secretId, input.record);
    const result = {
      changed: true,
      wasReplay: false,
      record: input.record,
    } as const;
    this.replayByOperation.set(input.mutation.operationKey, result);
    return result;
  }

  async saveSecret(record: SecretRecord, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    const replay = this.replayByOperation.get(mutation.operationKey);
    if (replay?.record) {
      return {
        changed: false,
        wasReplay: true,
        record: replay.record,
      };
    }

    const prior = this.records.get(record.secretId);
    this.records.set(record.secretId, record);
    const changed = JSON.stringify(prior) !== JSON.stringify(record);
    const result = { changed, wasReplay: false, record } as const;
    this.replayByOperation.set(mutation.operationKey, result);
    return result;
  }

  async deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    const replay = this.replayByOperation.get(mutation.operationKey);
    if (replay) {
      return { changed: false, wasReplay: true };
    }
    const existing = this.records.get(secretId.trim());
    if (!existing) {
      const result = { changed: false, wasReplay: false } as const;
      this.replayByOperation.set(mutation.operationKey, result);
      return result;
    }
    const softDeleted = softDeleteSecretRecord({
      record: existing,
      softDeletedBy: mutation.actorId,
      softDeletedAt: mutation.occurredAt,
    });
    this.records.set(secretId.trim(), softDeleted);
    const changed = existing.state !== SecretRecordStates.softDeleted;
    const result = { changed, wasReplay: false } as const;
    this.replayByOperation.set(mutation.operationKey, result);
    return result;
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  private readonly plaintextByPayloadRef = new Map<string, string>();

  async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretRecord["owner"];
    readonly plaintext: string;
    readonly existingContext?: SecretRecord["versions"][number]["keyEncryptionContext"];
  }) {
    const payloadIndex = this.plaintextByPayloadRef.size + 1;
    const encryptedPayloadRef = `enc:${input.secretId}:${payloadIndex}`;
    this.plaintextByPayloadRef.set(encryptedPayloadRef, input.plaintext);

    return {
      encryptedPayloadRef,
      payloadDigestSha256: `sha256:${input.secretId}:${input.plaintext.length}:${payloadIndex}`,
      payloadByteLength: input.plaintext.length,
      keyEncryptionContext: input.existingContext ?? {
        keyId: `kek:${input.owner.scope}:default`,
        algorithm: "aes-256-gcm",
        scope: input.owner.scope,
        workspaceId: input.owner.workspaceId,
        userIdentityId: input.owner.userIdentityId,
      },
    };
  }

  async decryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly version: SecretRecord["versions"][number];
  }): Promise<{ readonly plaintext: string }> {
    const plaintext = this.plaintextByPayloadRef.get(input.version.encryptedPayloadRef);
    if (plaintext === undefined) {
      throw new Error(`Secret plaintext for '${input.secretId}' was not found.`);
    }
    return { plaintext };
  }
}

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

class InMemorySecretAccessAuditPort implements ISecretAccessAuditPort {
  public readonly events: SecretAccessAuditEvent[] = [];

  async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class InMemorySecretManagementService implements ISecretManagementService {
  public constructor(
    private readonly repository: ISecretRecordPersistenceRepository,
    private readonly encryptionPort: ISecretEncryptionPort,
    private readonly accessPolicyPort: ISecretAccessPolicyPort,
    private readonly auditPort: ISecretAccessAuditPort,
  ) {}

  async createSecret(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>> {
    const existing = await this.repository.findSecretByNameAndScope({ name: request.name, owner: request.owner });
    if (existing) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.conflict,
          message: "Secret name already exists in the requested scope.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.create,
      actor: request.actor,
      owner: request.owner,
      occurredAt: request.createdAt,
    });

    if (!decision.allowed) {
      await this.emitAudit(request.actor, request.owner.scope, SecretAccessActions.create, "denied", decision.reason, decision.occurredAt);
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret create access denied.",
        },
      };
    }

    const encrypted = await this.encryptionPort.encryptSecretPlaintext({
      secretId: request.secretId,
      owner: request.owner,
      plaintext: request.plaintext,
    });

    const record = createSecretRecord({
      secretId: request.secretId,
      name: request.name,
      owner: request.owner,
      kind: request.kind,
      metadata: request.metadata,
      createdBy: request.actor.actorId,
      createdAt: request.createdAt,
      initialVersion: {
        versionId: `${request.secretId}:v1`,
        createdBy: request.actor.actorId,
        ...encrypted,
      },
    });

    await this.repository.createSecret({
      record,
      mutation: {
        operationKey: request.operationKey,
        actorId: request.actor.actorId,
        occurredAt: request.createdAt,
      },
    });

    await this.emitAudit(request.actor, request.owner.scope, SecretAccessActions.create, "allowed", "allowed", record.createdAt, record.secretId);
    return {
      ok: true,
      value: {
        secret: toSecretReference(record),
      },
    };
  }

  async getSecretMetadata(request: GetSecretMetadataRequest): Promise<SecretServiceResult<SecretReference>> {
    const record = await this.repository.findSecretById(request.secretId);
    if (!record) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "Secret was not found.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.readMetadata,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt: request.occurredAt,
    });
    await this.emitAudit(
      request.actor,
      record.owner.scope,
      SecretAccessActions.readMetadata,
      decision.allowed ? "allowed" : "denied",
      decision.reason,
      decision.occurredAt,
      record.secretId,
    );

    if (!decision.allowed) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret metadata access denied.",
        },
      };
    }

    return {
      ok: true,
      value: toSecretReference(record),
    };
  }

  async retrieveSecretPlaintextForRuntime(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>> {
    const record = await this.repository.findSecretById(request.secretId);
    if (!record) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "Secret was not found.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.retrievePlaintext,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt: request.occurredAt,
    });
    await this.emitAudit(
      request.actor,
      record.owner.scope,
      SecretAccessActions.retrievePlaintext,
      decision.allowed ? "allowed" : "denied",
      decision.reason,
      decision.occurredAt,
      record.secretId,
    );

    if (!decision.allowed) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret plaintext access denied.",
        },
      };
    }

    const current = record.versions.find((version) => version.versionId === record.currentVersionId);
    if (!current) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.invalidState,
          message: "Secret current version is missing.",
        },
      };
    }

    const plaintext = await this.encryptionPort.decryptSecretPlaintext({
      secretId: record.secretId,
      version: current,
    });

    return {
      ok: true,
      value: {
        secretId: record.secretId,
        currentVersionId: current.versionId,
        scope: record.owner,
        plaintext: plaintext.plaintext,
      },
    };
  }

  async rotateSecret(request: RotateSecretRequest): Promise<SecretServiceResult<RotateSecretResult>> {
    const record = await this.repository.findSecretById(request.secretId);
    if (!record) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "Secret was not found.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.rotate,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt: request.rotatedAt,
    });
    if (!decision.allowed) {
      await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.rotate, "denied", decision.reason, decision.occurredAt, record.secretId);
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret rotate access denied.",
        },
      };
    }

    const encrypted = await this.encryptionPort.encryptSecretPlaintext({
      secretId: record.secretId,
      owner: record.owner,
      plaintext: request.plaintext,
      existingContext: record.versions.find((version) => version.versionId === record.currentVersionId)?.keyEncryptionContext,
    });

    const rotated = rotateSecretRecord({
      record,
      rotatedBy: request.actor.actorId,
      rotatedAt: request.rotatedAt,
      nextVersion: {
        versionId: `${record.secretId}:v${record.versions.length + 1}`,
        createdBy: request.actor.actorId,
        ...encrypted,
      },
    });

    const saved = await this.repository.saveSecret(rotated, {
      operationKey: request.operationKey,
      actorId: request.actor.actorId,
      occurredAt: request.rotatedAt,
    });

    await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.rotate, "allowed", "allowed", rotated.lastModifiedAt, record.secretId);

    return {
      ok: true,
      value: {
        secret: toSecretReference(saved.record),
        currentVersionId: saved.record.currentVersionId ?? "",
      },
    };
  }

  async disableSecret(request: DisableSecretRequest): Promise<SecretServiceResult<SecretReference>> {
    const record = await this.repository.findSecretById(request.secretId);
    if (!record) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "Secret was not found.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.disable,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt: request.disabledAt,
    });
    if (!decision.allowed) {
      await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.disable, "denied", decision.reason, decision.occurredAt, record.secretId);
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret disable access denied.",
        },
      };
    }

    const disabled = disableSecretRecord({
      record,
      disabledBy: request.actor.actorId,
      disabledAt: request.disabledAt,
    });

    const saved = await this.repository.saveSecret(disabled, {
      operationKey: request.operationKey,
      actorId: request.actor.actorId,
      occurredAt: request.disabledAt,
    });

    await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.disable, "allowed", "allowed", disabled.lastModifiedAt, record.secretId);
    return {
      ok: true,
      value: toSecretReference(saved.record),
    };
  }

  async deleteSecret(request: DeleteSecretRequest): Promise<SecretServiceResult<{ readonly secretId: string }>> {
    const record = await this.repository.findSecretById(request.secretId);
    if (!record) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.notFound,
          message: "Secret was not found.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.delete,
      actor: request.actor,
      owner: record.owner,
      record,
      occurredAt: request.softDeletedAt,
    });
    if (!decision.allowed) {
      await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.delete, "denied", decision.reason, decision.occurredAt, record.secretId);
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret delete access denied.",
        },
      };
    }

    const deleted = softDeleteSecretRecord({
      record,
      softDeletedBy: request.actor.actorId,
      softDeletedAt: request.softDeletedAt,
    });
    await this.repository.saveSecret(deleted, {
      operationKey: `${request.operationKey}:mark-deleted`,
      actorId: request.actor.actorId,
      occurredAt: request.softDeletedAt,
    });
    await this.repository.deleteSecret(request.secretId, {
      operationKey: request.operationKey,
      actorId: request.actor.actorId,
      occurredAt: request.softDeletedAt,
    });

    await this.emitAudit(request.actor, record.owner.scope, SecretAccessActions.delete, "allowed", "allowed", deleted.lastModifiedAt, record.secretId);
    return {
      ok: true,
      value: {
        secretId: request.secretId,
      },
    };
  }

  async listSecrets(request: ListSecretsRequest): Promise<SecretServiceResult<ListSecretsResult>> {
    if (!request.owner) {
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.invalidRequest,
          message: "List secrets owner scope is required.",
        },
      };
    }

    const decision = await this.accessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.list,
      actor: request.actor,
      owner: request.owner,
    });

    if (!decision.allowed) {
      await this.emitAudit(request.actor, request.owner.scope, SecretAccessActions.list, "denied", decision.reason, decision.occurredAt);
      return {
        ok: false,
        error: {
          code: SecretServiceErrorCodes.accessDenied,
          message: "Secret list access denied.",
        },
      };
    }

    const items = await this.repository.listSecrets({
      scope: request.owner.scope,
      workspaceId: request.owner.workspaceId,
      userIdentityId: request.owner.userIdentityId,
      kinds: request.kinds,
      tagAnyOf: request.tagAnyOf,
      includeDisabled: request.includeDisabled,
      includeArchived: request.includeArchived,
      includeSoftDeleted: request.includeSoftDeleted,
      limit: request.limit,
      offset: request.offset,
    });

    await this.emitAudit(request.actor, request.owner.scope, SecretAccessActions.list, "allowed", "allowed", decision.occurredAt);
    return {
      ok: true,
      value: {
        items,
      },
    };
  }

  private async emitAudit(
    actor: SecretAccessActor,
    scope: SecretRecord["owner"]["scope"],
    action: Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }>["action"],
    decision: Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }>["decision"],
    reason: Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }>["reason"],
    occurredAt: string,
    secretId?: string,
  ): Promise<void> {
    await this.auditPort.recordSecretAuditEvent({
      eventKind: "secret.access-decision",
      action,
      decision,
      reason,
      actor: {
        actorId: actor.actorId,
        actorType: actor.actorType,
        workspaceId: actor.workspaceId,
        userIdentityId: actor.userIdentityId,
      },
      target: {
        secretId,
        scope,
      },
      occurredAt,
    });
  }
}

function createServerAdminActor(actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>): SecretAccessActor {
  return {
    actorId: "user:server-admin",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: actions,
  };
}

describe("secret application contracts", () => {
  it("supports create, metadata lookup, plaintext retrieval, rotation, disable, list, and delete flows", async () => {
    const repository = new InMemorySecretPersistenceRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const service = new InMemorySecretManagementService(repository, encryption, policy, audit);

    const created = await service.createSecret({
      actor: createServerAdminActor([
        SecretAccessActions.create,
        SecretAccessActions.readMetadata,
        SecretAccessActions.retrievePlaintext,
        SecretAccessActions.rotate,
        SecretAccessActions.disable,
        SecretAccessActions.delete,
        SecretAccessActions.list,
      ]),
      operationKey: "op:create:1",
      secretId: "secret:server:openai",
      name: "llm.openai.api_key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-test-123",
      metadata: {
        tags: ["openai", "production"],
        labels: {
          service: "openai",
        },
      },
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    expect(created.ok).toBeTrue();
    if (!created.ok) {
      return;
    }

    const metadata = await service.getSecretMetadata({
      actor: createServerAdminActor([SecretAccessActions.readMetadata]),
      secretId: "secret:server:openai",
      occurredAt: "2026-04-05T12:01:00.000Z",
    });
    expect(metadata.ok).toBeTrue();
    if (!metadata.ok) {
      return;
    }
    expect(metadata.value.state).toBe(SecretRecordStates.active);

    const plaintext = await service.retrieveSecretPlaintextForRuntime({
      actor: createServerAdminActor([SecretAccessActions.retrievePlaintext]),
      secretId: "secret:server:openai",
      operationKey: "op:retrieve:1",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "provider runtime invocation",
      },
      occurredAt: "2026-04-05T12:02:00.000Z",
    });
    expect(plaintext.ok).toBeTrue();
    if (!plaintext.ok) {
      return;
    }
    expect(plaintext.value.plaintext).toBe("sk-test-123");

    const rotated = await service.rotateSecret({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:1",
      secretId: "secret:server:openai",
      plaintext: "sk-test-456",
      rotatedAt: "2026-04-06T00:00:00.000Z",
    });
    expect(rotated.ok).toBeTrue();

    const afterRotate = await service.retrieveSecretPlaintextForRuntime({
      actor: createServerAdminActor([SecretAccessActions.retrievePlaintext]),
      secretId: "secret:server:openai",
      operationKey: "op:retrieve:2",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "provider runtime invocation",
      },
      occurredAt: "2026-04-06T00:00:01.000Z",
    });
    expect(afterRotate).toEqual({
      ok: true,
      value: {
        secretId: "secret:server:openai",
        currentVersionId: "secret:server:openai:v2",
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: "sk-test-456",
      },
    });

    const disabled = await service.disableSecret({
      actor: createServerAdminActor([SecretAccessActions.disable]),
      operationKey: "op:disable:1",
      secretId: "secret:server:openai",
      disabledAt: "2026-04-06T01:00:00.000Z",
    });
    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      return;
    }
    expect(disabled.value.state).toBe(SecretRecordStates.disabled);

    const deniedAfterDisable = await service.retrieveSecretPlaintextForRuntime({
      actor: createServerAdminActor([SecretAccessActions.retrievePlaintext]),
      secretId: "secret:server:openai",
      operationKey: "op:retrieve:3",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "provider runtime invocation",
      },
      occurredAt: "2026-04-06T01:05:00.000Z",
    });
    expect(deniedAfterDisable).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.accessDenied,
      }),
    });

    const listed = await service.listSecrets({
      actor: createServerAdminActor([SecretAccessActions.list]),
      owner: { scope: SecretScopes.server },
      includeDisabled: true,
      tagAnyOf: ["openai"],
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok) {
      return;
    }
    expect(listed.value.items).toHaveLength(1);

    const deleted = await service.deleteSecret({
      actor: createServerAdminActor([SecretAccessActions.delete]),
      operationKey: "op:delete:1",
      secretId: "secret:server:openai",
      softDeletedAt: "2026-04-06T02:00:00.000Z",
    });
    expect(deleted).toEqual({
      ok: true,
      value: {
        secretId: "secret:server:openai",
      },
    });

    const metadataAfterDelete = await service.getSecretMetadata({
      actor: createServerAdminActor([SecretAccessActions.readMetadata]),
      secretId: "secret:server:openai",
    });
    expect(metadataAfterDelete.ok).toBeTrue();
    if (!metadataAfterDelete.ok) {
      return;
    }
    expect(metadataAfterDelete.value.state).toBe(SecretRecordStates.softDeleted);

    expect(audit.events.length).toBeGreaterThanOrEqual(8);
    const deniedRetrieve = audit.events
      .filter((event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }> => event.eventKind === "secret.access-decision")
      .some((event) => event.action === SecretAccessActions.retrievePlaintext && event.decision === "denied");
    expect(deniedRetrieve).toBeTrue();
  });

  it("returns access denied for scope-mismatched actor", async () => {
    const repository = new InMemorySecretPersistenceRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const service = new InMemorySecretManagementService(repository, encryption, policy, audit);

    await service.createSecret({
      actor: {
        actorId: "user:workspace-1-admin",
        actorType: SecretActorTypes.workspaceMember,
        workspaceId: "workspace:1",
        grantedActions: [SecretAccessActions.create],
      },
      operationKey: "op:create:workspace",
      secretId: "secret:workspace:service",
      name: "workspace.service.api_token",
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:1",
      },
      kind: SecretKinds.accessToken,
      plaintext: "workspace-token",
    });

    const denied = await service.getSecretMetadata({
      actor: {
        actorId: "user:other-workspace",
        actorType: SecretActorTypes.workspaceMember,
        workspaceId: "workspace:2",
        grantedActions: [SecretAccessActions.readMetadata],
      },
      secretId: "secret:workspace:service",
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.accessDenied,
      }),
    });
    const lastDecision = [...audit.events]
      .reverse()
      .find((event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }> => event.eventKind === "secret.access-decision");
    expect(lastDecision?.reason).toBe("scope-mismatch");
  });
});

