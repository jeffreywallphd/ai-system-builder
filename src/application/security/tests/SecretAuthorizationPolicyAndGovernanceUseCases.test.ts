import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretRecordStates,
  SecretScopes,
  archiveSecretRecord,
  createSecretRecord,
  softDeleteSecretRecord,
  toSecretReference,
  type SecretAccessActor,
  type SecretRecord,
} from "@domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  SecretAccessAuditEvent,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
} from "../ports/SecretServicePorts";
import { DisableSecretUseCase } from "../use-cases/DisableSecretUseCase";
import { CreateSecretUseCase } from "../use-cases/CreateSecretUseCase";
import { GetSecretMetadataUseCase } from "../use-cases/GetSecretMetadataUseCase";
import { ListSecretsUseCase } from "../use-cases/ListSecretsUseCase";
import { RetrieveSecretPlaintextForRuntimeUseCase } from "../use-cases/RetrieveSecretPlaintextForRuntimeUseCase";
import { RotateSecretUseCase } from "../use-cases/RotateSecretUseCase";
import { SecretAuthorizationPolicyEvaluator } from "../use-cases/SecretAuthorizationPolicyEvaluator";
import { SecretServiceErrorCodes } from "../use-cases/SecretManagementServiceContracts";
import { DeleteSecretUseCase } from "../use-cases/DeleteSecretUseCase";

class InMemorySecretRecordRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  public async findSecretByNameAndScope(input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    const normalizedName = input.name.trim().toLowerCase();
    for (const record of this.records.values()) {
      if (
        record.reference.name === normalizedName
        && record.owner.scope === input.owner.scope
        && record.owner.workspaceId === input.owner.workspaceId
        && record.owner.userIdentityId === input.owner.userIdentityId
      ) {
        return record;
      }
    }
    return undefined;
  }

  public async listSecrets(query: SecretListQuery): Promise<ReadonlyArray<ReturnType<typeof toSecretReference>>> {
    return [...this.records.values()]
      .filter((record) => {
        if (query.scope && record.owner.scope !== query.scope) {
          return false;
        }
        if (query.workspaceId && record.owner.workspaceId !== query.workspaceId) {
          return false;
        }
        if (query.userIdentityId && record.owner.userIdentityId !== query.userIdentityId) {
          return false;
        }
        if (query.kinds?.length && !query.kinds.includes(record.kind)) {
          return false;
        }
        if (query.tagAnyOf?.length) {
          const tags = new Set(record.reference.metadata.tags.map((tag) => tag.toLowerCase()));
          const matches = query.tagAnyOf.some((tag) => tags.has(tag.toLowerCase()));
          if (!matches) {
            return false;
          }
        }
        if (!(query.includeDisabled ?? false) && record.state === "disabled") {
          return false;
        }
        if (!(query.includeArchived ?? false) && record.state === "archived") {
          return false;
        }
        if (!(query.includeSoftDeleted ?? false) && record.state === "soft-deleted") {
          return false;
        }
        return true;
      })
      .map((record) => toSecretReference(record));
  }

  public async createSecret(
    input: SecretCreatePersistenceInput,
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(input.record.secretId, input.record);
    return {
      changed: true,
      wasReplay: false,
      record: input.record,
    };
  }

  public async saveSecret(
    record: SecretRecord,
    _mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(record.secretId, record);
    return {
      changed: true,
      wasReplay: false,
      record,
    };
  }

  public async deleteSecret(secretId: string, mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    const existing = this.records.get(secretId.trim());
    if (!existing) {
      return {
        changed: false,
        wasReplay: false,
      };
    }
    const deleted = softDeleteSecretRecord({
      record: existing,
      softDeletedBy: mutation.actorId,
      softDeletedAt: mutation.occurredAt,
    });
    this.records.set(secretId.trim(), deleted);
    const changed = existing.state !== SecretRecordStates.softDeleted;
    return {
      changed,
      wasReplay: false,
    };
  }

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  private readonly plaintextByPayloadRef = new Map<string, string>();

  public seedPayload(payloadRef: string, plaintext: string): void {
    this.plaintextByPayloadRef.set(payloadRef, plaintext);
  }

  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretRecord["owner"];
    readonly plaintext: string;
    readonly existingContext?: SecretRecord["versions"][number]["keyEncryptionContext"];
  }) {
    const encryptedPayloadRef = `enc:${input.secretId}:v${this.plaintextByPayloadRef.size + 1}`;
    this.plaintextByPayloadRef.set(encryptedPayloadRef, input.plaintext);
    return {
      encryptedPayloadRef,
      payloadDigestSha256: `sha256:${input.secretId}:${input.plaintext.length}`,
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

  public async decryptSecretPlaintext(input: {
    readonly version: SecretRecord["versions"][number];
  }): Promise<{ readonly plaintext: string }> {
    const plaintext = this.plaintextByPayloadRef.get(input.version.encryptedPayloadRef);
    if (plaintext === undefined) {
      throw new Error("missing plaintext payload");
    }
    return { plaintext };
  }
}

class InMemorySecretAccessAuditPort implements ISecretAccessAuditPort {
  public readonly events: SecretAccessAuditEvent[] = [];

  public async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("Secret authorization policy and governance use cases", () => {
  it("records structured operation audit events for all secret-sensitive operations", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const secretId = "secret:server:audited-flow";
    const createUseCase = new CreateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const metadataUseCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const disableUseCase = new DisableSecretUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const deleteUseCase = new DeleteSecretUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const createResult = await createUseCase.execute({
      actor: {
        actorId: "user:server-admin",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: [SecretAccessActions.create],
      },
      operationKey: "op:create:audited-flow",
      secretId,
      name: "provider.openai.audit-flow",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-audit-create",
      metadata: {
        tags: ["openai", "audit"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    });
    expect(createResult.ok).toBeTrue();

    const metadataResult = await metadataUseCase.execute({
      actor: {
        actorId: "user:server-admin",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: [SecretAccessActions.readMetadata],
      },
      secretId,
    });
    expect(metadataResult.ok).toBeTrue();

    const retrieveResult = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId,
      operationKey: "op:retrieve:audited-flow",
      runtimeContext: {
        serviceIdentity: "runtime:server:audited-flow",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "runtime operation audit verification",
      },
    });
    expect(retrieveResult.ok).toBeTrue();

    const rotateResult = await rotateUseCase.execute({
      actor: {
        actorId: "user:server-admin",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: [SecretAccessActions.rotate],
      },
      operationKey: "op:rotate:audited-flow",
      secretId,
      plaintext: "sk-audit-rotate",
    });
    expect(rotateResult.ok).toBeTrue();

    const disableResult = await disableUseCase.execute({
      actor: {
        actorId: "user:server-admin",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: [SecretAccessActions.disable],
      },
      operationKey: "op:disable:audited-flow",
      secretId,
    });
    expect(disableResult.ok).toBeTrue();

    const deleteResult = await deleteUseCase.execute({
      actor: {
        actorId: "user:server-admin",
        actorType: SecretActorTypes.serverAdmin,
        grantedActions: [SecretAccessActions.delete],
      },
      operationKey: "op:delete:audited-flow",
      secretId,
    });
    expect(deleteResult.ok).toBeTrue();

    const operationEvents = audit.events.filter(
      (event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.operation" }> =>
        event.eventKind === "secret.operation",
    );
    expect(operationEvents.length).toBeGreaterThanOrEqual(6);
    expect(operationEvents.filter((event) => event.status === "succeeded").map((event) => event.operation)).toEqual([
      SecretAccessActions.create,
      SecretAccessActions.readMetadata,
      SecretAccessActions.retrievePlaintext,
      SecretAccessActions.rotate,
      SecretAccessActions.disable,
      SecretAccessActions.delete,
    ]);
    expect(JSON.stringify(operationEvents)).not.toContain("sk-audit-create");
    expect(JSON.stringify(operationEvents)).not.toContain("sk-audit-rotate");
  });

  it("denies runtime actors for administrative secret mutations", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const createUseCase = new CreateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const result = await createUseCase.execute({
      actor: {
        actorId: "system:runtime:workspace-alpha",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:alpha",
        grantedActions: [SecretAccessActions.create],
      },
      operationKey: "op:create:runtime-denied",
      secretId: "secret:workspace:runtime-denied",
      name: "integration.runtime.denied-token",
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      kind: SecretKinds.accessToken,
      plaintext: "runtime-token",
      metadata: {
        tags: ["integration"],
        labels: {
          integration: "workspace-runtime",
          pairing: "runtime-session",
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.accessDenied,
      }),
    });
    const accessEvent = [...audit.events].reverse().find((event) => event.eventKind === "secret.access-decision");
    expect(accessEvent && "reason" in accessEvent ? accessEvent.reason : undefined).toBe("administrative-access-required");
  });

  it("treats plaintext retrieval as stricter than metadata visibility for human actors", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const record = createWorkspaceSecretRecord("workspace:alpha");
    repository.seed(record);
    encryption.seedPayload(record.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-token");

    const metadataUseCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const actor: SecretAccessActor = {
      actorId: "user:workspace-member",
      actorType: SecretActorTypes.workspaceMember,
      workspaceId: "workspace:alpha",
      grantedActions: [SecretAccessActions.readMetadata, SecretAccessActions.retrievePlaintext],
    };

    const metadata = await metadataUseCase.execute({
      actor,
      secretId: record.secretId,
    });
    expect(metadata.ok).toBeTrue();

    const plaintext = await retrieveUseCase.execute({
      actor,
      secretId: record.secretId,
      operationKey: "op:retrieve:human-runtime-denied",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:orchestrator",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        justification: "workspace runtime provider call",
      },
    });
    expect(plaintext).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${record.secretId}' was not found.`,
      },
    });
    const runtimeDenied = [...audit.events].reverse().find((event) => event.eventKind === "secret.access-decision");
    expect(runtimeDenied && "reason" in runtimeDenied ? runtimeDenied.reason : undefined).toBe("runtime-access-required");
  });

  it("allows system runtime plaintext retrieval within scope boundaries", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const record = createWorkspaceSecretRecord("workspace:beta");
    repository.seed(record);
    encryption.seedPayload(record.versions[0]?.encryptedPayloadRef ?? "", "workspace-beta-token");

    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const result = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:workspace-beta",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:beta",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: record.secretId,
      operationKey: "op:retrieve:workspace-beta-runtime",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-beta:storage",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:beta",
        },
        justification: "runtime storage connector request signing",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        secretId: record.secretId,
        currentVersionId: record.currentVersionId,
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:beta",
        },
        plaintext: "workspace-beta-token",
      },
    });
    const runtimeAllowed = [...audit.events].reverse().find((event) => event.eventKind === "secret.access-decision");
    expect(runtimeAllowed && "decision" in runtimeAllowed ? runtimeAllowed.decision : undefined).toBe("allowed");
    expect(runtimeAllowed && "operationKey" in runtimeAllowed ? runtimeAllowed.operationKey : undefined).toBe("op:retrieve:workspace-beta-runtime");
    expect(runtimeAllowed && "serviceIdentity" in runtimeAllowed ? runtimeAllowed.serviceIdentity : undefined).toBe("runtime:workspace-beta:storage");
  });

  it("enforces server-scope boundary for server runtime actors", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const record = createServerSecretRecord();
    repository.seed(record);
    encryption.seedPayload(record.versions[0]?.encryptedPayloadRef ?? "", "server-secret");

    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const allowed = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: record.secretId,
      operationKey: "op:retrieve:server-runtime",
      runtimeContext: {
        serviceIdentity: "runtime:server:signing",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "issue internal service signature",
      },
    });
    expect(allowed.ok).toBeTrue();

    const denied = await retrieveUseCase.execute({
      actor: {
        actorId: "user:workspace-admin",
        actorType: SecretActorTypes.workspaceMember,
        workspaceId: "workspace:alpha",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: record.secretId,
      operationKey: "op:retrieve:server-secret-human",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:ui",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "manual UI retrieval",
      },
    });
    expect(denied).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${record.secretId}' was not found.`,
      },
    });
    const serverDenied = [...audit.events].reverse().find((event) => event.eventKind === "secret.access-decision");
    expect(serverDenied && "reason" in serverDenied ? serverDenied.reason : undefined).toBe("runtime-access-required");
  });

  it("returns non-leaky not-found when runtime scope reference does not match the secret owner", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const record = createWorkspaceSecretRecord("workspace:alpha");
    repository.seed(record);
    encryption.seedPayload(record.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-token");

    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const denied = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:workspace-alpha",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:alpha",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: record.secretId,
      operationKey: "op:retrieve:workspace-alpha-mismatched-scope",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:storage",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:beta",
        },
        justification: "runtime data-plane request",
      },
    });

    expect(denied).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${record.secretId}' was not found.`,
      },
    });
    const mismatchDenied = [...audit.events].reverse().find((event) => event.eventKind === "secret.access-decision");
    expect(mismatchDenied && "reason" in mismatchDenied ? mismatchDenied.reason : undefined).toBe("scope-mismatch");
    expect(mismatchDenied && "operationKey" in mismatchDenied ? mismatchDenied.operationKey : undefined).toBe("op:retrieve:workspace-alpha-mismatched-scope");
  });

  it("rejects runtime plaintext retrieval requests that omit audit justification context", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const record = createWorkspaceSecretRecord("workspace:alpha");
    repository.seed(record);
    encryption.seedPayload(record.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-token");

    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const invalid = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:workspace-alpha",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:alpha",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: record.secretId,
      operationKey: "op:retrieve:workspace-alpha-missing-justification",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:storage",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        justification: " ",
      },
    });

    expect(invalid).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidRequest,
        message: "runtimeContext.justification is required.",
      },
    });
    expect(audit.events).toHaveLength(0);
  });

  it("returns non-leaky not-found for unauthorized rotate and delete operations", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();
    const record = createWorkspaceSecretRecord("workspace:alpha");
    repository.seed(record);

    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const deleteUseCase = new DeleteSecretUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const actor: SecretAccessActor = {
      actorId: "user:workspace-gamma-admin",
      actorType: SecretActorTypes.workspaceMember,
      workspaceId: "workspace:gamma",
      grantedActions: [SecretAccessActions.rotate, SecretAccessActions.delete],
    };

    const rotate = await rotateUseCase.execute({
      actor,
      operationKey: "op:rotate:unauthorized",
      secretId: record.secretId,
      plaintext: "new-value",
    });
    expect(rotate).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${record.secretId}' was not found.`,
      },
    });

    const deleted = await deleteUseCase.execute({
      actor,
      operationKey: "op:delete:unauthorized",
      secretId: record.secretId,
    });
    expect(deleted).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${record.secretId}' was not found.`,
      },
    });
    const reasons = audit.events
      .filter((event): event is Extract<SecretAccessAuditEvent, { readonly eventKind: "secret.access-decision" }> => event.eventKind === "secret.access-decision")
      .map((event) => event.reason);
    expect(reasons).toEqual(["scope-mismatch", "scope-mismatch"]);
  });

  it("enforces workspace and user boundaries for list and disable operations", async () => {
    const repository = new InMemorySecretRecordRepository();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const workspaceRecord = createWorkspaceSecretRecord("workspace:alpha");
    const userRecord = createUserSecretRecord("user:alice", "workspace:alpha");
    repository.seed(workspaceRecord);
    repository.seed(userRecord);

    const listUseCase = new ListSecretsUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const disableUseCase = new DisableSecretUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const deniedList = await listUseCase.execute({
      actor: {
        actorId: "user:workspace-other",
        actorType: SecretActorTypes.workspaceMember,
        workspaceId: "workspace:other",
        grantedActions: [SecretAccessActions.list],
      },
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });
    expect(deniedList).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.accessDenied,
      }),
    });

    const userList = await listUseCase.execute({
      actor: {
        actorId: "user:alice",
        actorType: SecretActorTypes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alice",
        grantedActions: [SecretAccessActions.list],
      },
      owner: {
        scope: SecretScopes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alice",
      },
    });

    expect(userList.ok).toBeTrue();
    if (!userList.ok) {
      return;
    }
    expect(userList.value.items).toHaveLength(1);
    expect(userList.value.items[0]?.secretId).toBe(userRecord.secretId);

    const disabled = await disableUseCase.execute({
      actor: {
        actorId: "user:alice",
        actorType: SecretActorTypes.user,
        workspaceId: "workspace:alpha",
        userIdentityId: "user:alice",
        grantedActions: [SecretAccessActions.disable],
      },
      operationKey: "op:disable:user-secret",
      secretId: userRecord.secretId,
    });

    expect(disabled.ok).toBeTrue();
    if (!disabled.ok) {
      return;
    }
    expect(disabled.value.state).toBe("disabled");
  });

  it("supports archival and soft-delete visibility filters while denying runtime retrieval", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const audit = new InMemorySecretAccessAuditPort();
    const policy = new SecretAuthorizationPolicyEvaluator();

    const active = createSecretRecord({
      secretId: "secret:workspace:alpha:active",
      name: "integration.alpha.runtime-token.active",
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      kind: SecretKinds.accessToken,
      createdBy: "user:workspace-owner",
      createdAt: "2026-04-05T12:00:00.000Z",
      metadata: {
        tags: ["workspace", "runtime"],
        labels: {
          provider: "workspace-runtime",
          usage: "service-runtime",
        },
      },
      initialVersion: {
        versionId: "secret:workspace:alpha:active:v1",
        createdBy: "user:workspace-owner",
        encryptedPayloadRef: "enc:secret:workspace:alpha:active:v1",
        payloadDigestSha256: "sha256:workspace:alpha:active:v1",
        payloadByteLength: 21,
        keyEncryptionContext: {
          keyId: "kek:workspace:default",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
      },
    });
    const archived = archiveSecretRecord({
      record: createSecretRecord({
        secretId: "secret:workspace:alpha:archived",
        name: "integration.alpha.runtime-token.archived",
        owner: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        kind: SecretKinds.accessToken,
        createdBy: "user:workspace-owner",
        createdAt: "2026-04-05T12:10:00.000Z",
        metadata: {
          tags: ["workspace", "runtime"],
          labels: {
            provider: "workspace-runtime",
            usage: "service-runtime",
          },
        },
        initialVersion: {
          versionId: "secret:workspace:alpha:archived:v1",
          createdBy: "user:workspace-owner",
          encryptedPayloadRef: "enc:secret:workspace:alpha:archived:v1",
          payloadDigestSha256: "sha256:workspace:alpha:archived:v1",
          payloadByteLength: 30,
          keyEncryptionContext: {
            keyId: "kek:workspace:default",
            algorithm: "aes-256-gcm",
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
        },
      }),
      archivedBy: "user:workspace-owner",
      archivedAt: "2026-04-06T03:00:00.000Z",
    });
    const softDeleted = softDeleteSecretRecord({
      record: archiveSecretRecord({
        record: createSecretRecord({
          secretId: "secret:workspace:alpha:soft-deleted",
          name: "integration.alpha.runtime-token.soft-deleted",
          owner: {
            scope: SecretScopes.workspace,
            workspaceId: "workspace:alpha",
          },
          kind: SecretKinds.accessToken,
          createdBy: "user:workspace-owner",
          createdAt: "2026-04-05T12:20:00.000Z",
          metadata: {
            tags: ["workspace", "runtime"],
            labels: {
              provider: "workspace-runtime",
              usage: "service-runtime",
            },
          },
          initialVersion: {
            versionId: "secret:workspace:alpha:soft-deleted:v1",
            createdBy: "user:workspace-owner",
            encryptedPayloadRef: "enc:secret:workspace:alpha:soft-deleted:v1",
            payloadDigestSha256: "sha256:workspace:alpha:soft-deleted:v1",
            payloadByteLength: 34,
            keyEncryptionContext: {
              keyId: "kek:workspace:default",
              algorithm: "aes-256-gcm",
              scope: SecretScopes.workspace,
              workspaceId: "workspace:alpha",
            },
          },
        }),
        archivedBy: "user:workspace-owner",
        archivedAt: "2026-04-06T03:10:00.000Z",
      }),
      softDeletedBy: "user:workspace-owner",
      softDeletedAt: "2026-04-06T03:20:00.000Z",
    });
    repository.seed(active);
    repository.seed(archived);
    repository.seed(softDeleted);
    encryption.seedPayload(active.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-token");
    encryption.seedPayload(archived.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-archived-token");
    encryption.seedPayload(softDeleted.versions[0]?.encryptedPayloadRef ?? "", "workspace-alpha-soft-deleted-token");

    const listUseCase = new ListSecretsUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const metadataUseCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const actor: SecretAccessActor = {
      actorId: "user:workspace-owner",
      actorType: SecretActorTypes.workspaceMember,
      workspaceId: "workspace:alpha",
      grantedActions: [SecretAccessActions.list, SecretAccessActions.readMetadata, SecretAccessActions.retrievePlaintext],
    };

    const defaultList = await listUseCase.execute({
      actor,
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
    });
    expect(defaultList.ok).toBeTrue();
    if (!defaultList.ok) {
      return;
    }
    expect(defaultList.value.items.map((item) => item.state)).toEqual(["active"]);

    const includeArchived = await listUseCase.execute({
      actor,
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      includeArchived: true,
    });
    expect(includeArchived.ok).toBeTrue();
    if (!includeArchived.ok) {
      return;
    }
    expect(includeArchived.value.items.some((item) => item.state === "archived")).toBeTrue();

    const includeSoftDeleted = await listUseCase.execute({
      actor,
      owner: {
        scope: SecretScopes.workspace,
        workspaceId: "workspace:alpha",
      },
      includeArchived: true,
      includeSoftDeleted: true,
    });
    expect(includeSoftDeleted.ok).toBeTrue();
    if (!includeSoftDeleted.ok) {
      return;
    }
    expect(includeSoftDeleted.value.items.some((item) => item.state === "soft-deleted")).toBeTrue();

    const archivedMetadata = await metadataUseCase.execute({
      actor,
      secretId: archived.secretId,
    });
    expect(archivedMetadata.ok).toBeTrue();
    if (!archivedMetadata.ok) {
      return;
    }
    expect(archivedMetadata.value.state).toBe("archived");

    const archivedRuntimeRetrieval = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:workspace-alpha",
        actorType: SecretActorTypes.workspaceService,
        workspaceId: "workspace:alpha",
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: archived.secretId,
      operationKey: "op:retrieve:archived-runtime",
      runtimeContext: {
        serviceIdentity: "runtime:workspace-alpha:storage",
        scope: {
          scope: SecretScopes.workspace,
          workspaceId: "workspace:alpha",
        },
        justification: "runtime retrieval should fail for archived secret",
      },
    });
    expect(archivedRuntimeRetrieval).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.notFound,
        message: `Secret '${archived.secretId}' was not found.`,
      },
    });
  });
});

function createWorkspaceSecretRecord(workspaceId: string): SecretRecord {
  return createSecretRecord({
    secretId: `secret:workspace:${workspaceId}`,
    name: `integration.${workspaceId.replace("workspace:", "")}.api-token`,
    owner: {
      scope: SecretScopes.workspace,
      workspaceId,
    },
    kind: SecretKinds.accessToken,
    createdBy: "user:workspace-owner",
    createdAt: "2026-04-05T12:00:00.000Z",
    metadata: {
      tags: ["workspace", "runtime"],
      labels: {
        provider: "workspace-runtime",
        usage: "service-runtime",
      },
    },
    initialVersion: {
      versionId: `secret:workspace:${workspaceId}:v1`,
      createdBy: "user:workspace-owner",
      encryptedPayloadRef: `enc:secret:workspace:${workspaceId}:v1`,
      payloadDigestSha256: `sha256:workspace:${workspaceId}:v1`,
      payloadByteLength: 21,
      keyEncryptionContext: {
        keyId: "kek:workspace:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.workspace,
        workspaceId,
      },
    },
  });
}

function createUserSecretRecord(userIdentityId: string, workspaceId: string): SecretRecord {
  return createSecretRecord({
    secretId: `secret:user:${userIdentityId}`,
    name: "personal.openai.api-key",
    owner: {
      scope: SecretScopes.user,
      workspaceId,
      userIdentityId,
    },
    kind: SecretKinds.apiKey,
    createdBy: userIdentityId,
    createdAt: "2026-04-05T12:00:00.000Z",
    metadata: {
      tags: ["personal", "openai"],
      labels: {
        provider: "openai",
        usage: "model-inference",
      },
    },
    initialVersion: {
      versionId: `secret:user:${userIdentityId}:v1`,
      createdBy: userIdentityId,
      encryptedPayloadRef: `enc:secret:user:${userIdentityId}:v1`,
      payloadDigestSha256: `sha256:user:${userIdentityId}:v1`,
      payloadByteLength: 18,
      keyEncryptionContext: {
        keyId: "kek:user:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.user,
        workspaceId,
        userIdentityId,
      },
    },
  });
}

function createServerSecretRecord(): SecretRecord {
  return createSecretRecord({
    secretId: "secret:server:openai",
    name: "provider.openai.api-key",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    createdBy: "user:server-admin",
    createdAt: "2026-04-05T12:00:00.000Z",
    metadata: {
      tags: ["server", "openai"],
      labels: {
        provider: "openai",
        usage: "model-inference",
      },
    },
    initialVersion: {
      versionId: "secret:server:openai:v1",
      createdBy: "user:server-admin",
      encryptedPayloadRef: "enc:secret:server:openai:v1",
      payloadDigestSha256: "sha256:secret:server:openai:v1",
      payloadByteLength: 14,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });
}

