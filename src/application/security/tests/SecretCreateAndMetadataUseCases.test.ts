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
} from "../../../domain/security/SecretDomain";
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
import type { ISecretObservabilityPort, SecretOperationalLogEvent } from "../ports/SecretObservabilityPorts";
import { SecretOperationalOutcomes } from "../ports/SecretObservabilityPorts";
import { CreateSecretUseCase } from "../use-cases/CreateSecretUseCase";
import { GetSecretMetadataUseCase } from "../use-cases/GetSecretMetadataUseCase";
import { SecretServiceErrorCodes } from "../use-cases/SecretManagementServiceContracts";

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

  public async listSecrets(_query: SecretListQuery): Promise<readonly SecretRecord["reference"][]> {
    return [];
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

  public async deleteSecret(_secretId: string, _mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    return {
      changed: true,
      wasReplay: false,
    };
  }

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretRecord["owner"];
    readonly plaintext: string;
  }) {
    return {
      encryptedPayloadRef: `enc:${input.secretId}:v1`,
      payloadDigestSha256: `sha256:${input.secretId}:${input.plaintext.length}`,
      payloadByteLength: input.plaintext.length,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: input.owner.scope,
        workspaceId: input.owner.workspaceId,
        userIdentityId: input.owner.userIdentityId,
      },
    };
  }

  public async decryptSecretPlaintext(): Promise<{ readonly plaintext: string }> {
    throw new Error("not needed for this story");
  }
}

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

class InMemorySecretAccessAuditPort implements ISecretAccessAuditPort {
  public readonly events: SecretAccessAuditEvent[] = [];

  public async recordSecretAccessDecision(event: SecretAccessAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class InMemorySecretObservabilityPort implements ISecretObservabilityPort {
  public readonly events: SecretOperationalLogEvent[] = [];

  public async recordSecretOperation(event: SecretOperationalLogEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("Secret create and metadata use cases", () => {
  it("creates a secret with encrypted material and returns metadata only", async () => {
    const repository = new InMemorySecretRecordRepository();
    const audit = new InMemorySecretAccessAuditPort();
    const observability = new InMemorySecretObservabilityPort();

    const useCase = new CreateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: new InMemorySecretEncryptionPort(),
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: audit,
      secretObservabilityPort: observability,
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:server-openai",
      secretId: "secret:server:openai",
      name: "provider.openai.api-key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-production-123",
      metadata: {
        tags: ["openai", "prod"],
        labels: {
          provider: "openai",
          usage: "model-inference",
          environment: "prod",
        },
      },
      createdAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.secret.secretId).toBe("secret:server:openai");
    expect(result.value.secret.kind).toBe(SecretKinds.apiKey);
    expect(JSON.stringify(result.value.secret)).not.toContain("sk-production-123");
    expect(JSON.stringify(result.value.secret)).not.toContain("encryptedPayloadRef");

    const persisted = await repository.findSecretById("secret:server:openai");
    expect(persisted?.versions[0]?.encryptedPayloadRef).toContain("enc:secret:server:openai");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: SecretAccessActions.create,
      decision: "allowed",
      actorId: "user:server-admin",
      occurredAt: "2026-04-05T12:00:00.000Z",
    });
    expect(observability.events).toHaveLength(1);
    expect(observability.events[0]).toMatchObject({
      event: "secret.create",
      outcome: SecretOperationalOutcomes.succeeded,
      secretId: "secret:server:openai",
      scope: SecretScopes.server,
    });
    expect(JSON.stringify(observability.events[0])).not.toContain("sk-production-123");
  });

  it("rejects duplicate secret key in the same scope", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createServerSecretRecord());

    const useCase = new CreateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: new InMemorySecretEncryptionPort(),
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:duplicate",
      secretId: "secret:server:openai-duplicate",
      name: "provider.openai.api-key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-production-456",
      metadata: {
        tags: ["openai", "prod"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.conflict,
      }),
    });
  });

  it("redacts plaintext from internal failures and observability payloads", async () => {
    const plaintext = "sk-sensitive-live-value";
    const repository = new InMemorySecretRecordRepository();
    const audit = new InMemorySecretAccessAuditPort();
    const observability = new InMemorySecretObservabilityPort();

    const useCase = new CreateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: {
        async encryptSecretPlaintext() {
          throw new Error(`encryption failed for ${plaintext}`);
        },
        async decryptSecretPlaintext() {
          return { plaintext: "not-used" };
        },
      },
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: audit,
      secretObservabilityPort: observability,
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:internal-failure",
      secretId: "secret:server:internal-failure",
      name: "provider.openai.api-key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext,
      metadata: {
        tags: ["openai"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
      createdAt: "2026-04-05T14:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.internal,
        message: "Secret create operation failed due to an internal security error.",
      },
    });

    expect(audit.events).toHaveLength(1);
    expect(observability.events).toHaveLength(1);
    expect(observability.events[0]).toMatchObject({
      event: "secret.create",
      outcome: SecretOperationalOutcomes.failed,
      secretId: "secret:server:internal-failure",
    });

    const serializedObservability = JSON.stringify(observability.events[0]);
    expect(serializedObservability).not.toContain(plaintext);
    expect(serializedObservability).toContain("[REDACTED]");
  });

  it("rejects invalid scope owner input with clear application error", async () => {
    const useCase = new CreateSecretUseCase({
      secretRecordRepository: new InMemorySecretRecordRepository(),
      secretEncryptionPort: new InMemorySecretEncryptionPort(),
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:invalid-scope",
      secretId: "secret:workspace:invalid",
      name: "provider.workspace.invalid",
      owner: {
        scope: SecretScopes.workspace,
      },
      kind: SecretKinds.accessToken,
      plaintext: "workspace-token",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidRequest,
        message: "Workspace-scoped secrets require workspaceId.",
      },
    });
  });

  it("rejects create requests that do not match seeded secret classification conventions", async () => {
    const useCase = new CreateSecretUseCase({
      secretRecordRepository: new InMemorySecretRecordRepository(),
      secretEncryptionPort: new InMemorySecretEncryptionPort(),
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:unsupported-classification",
      secretId: "secret:server:unsupported-classification",
      name: "llm.openai.api_key",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.apiKey,
      plaintext: "sk-production-789",
      metadata: {
        tags: ["openai"],
        labels: {
          provider: "openai",
          usage: "model-inference",
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidRequest,
        message:
          "Secret name 'llm.openai.api_key' must use a supported classification prefix (provider., personal., storage., signing., integration.).",
      },
    });
  });

  it("returns metadata without plaintext and records actor attribution", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createServerSecretRecord());
    const audit = new InMemorySecretAccessAuditPort();
    const observability = new InMemorySecretObservabilityPort();

    const useCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: audit,
      secretObservabilityPort: observability,
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([SecretAccessActions.readMetadata]),
      secretId: "secret:server:openai",
      occurredAt: "2026-04-06T08:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.secretId).toBe("secret:server:openai");
    expect(JSON.stringify(result.value)).not.toContain("sk-openai-live");
    expect(JSON.stringify(result.value)).not.toContain("payloadDigestSha256");
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: SecretAccessActions.readMetadata,
      decision: "allowed",
      actorId: "user:server-admin",
      occurredAt: "2026-04-06T08:00:00.000Z",
    });
    expect(observability.events).toHaveLength(1);
    expect(observability.events[0]).toMatchObject({
      event: "secret.read-metadata",
      outcome: SecretOperationalOutcomes.succeeded,
      secretId: "secret:server:openai",
      scope: SecretScopes.server,
    });
  });

  it("rejects metadata lookup when actor has no read permission", async () => {
    const repository = new InMemorySecretRecordRepository();
    repository.seed(createServerSecretRecord());

    const useCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const result = await useCase.execute({
      actor: createServerAdminActor([]),
      secretId: "secret:server:openai",
      occurredAt: "2026-04-06T09:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: SecretServiceErrorCodes.accessDenied,
      }),
    });
  });

  it("rejects invalid timestamps for create and metadata requests", async () => {
    const createUseCase = new CreateSecretUseCase({
      secretRecordRepository: new InMemorySecretRecordRepository(),
      secretEncryptionPort: new InMemorySecretEncryptionPort(),
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const createResult = await createUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.create]),
      operationKey: "op:secret:create:invalid-ts",
      secretId: "secret:server:invalid-ts",
      name: "provider.invalid.timestamp",
      owner: {
        scope: SecretScopes.server,
      },
      kind: SecretKinds.generic,
      plaintext: "value",
      createdAt: "not-a-timestamp",
    });

    expect(createResult).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidRequest,
        message: "createdAt must be a valid timestamp when provided.",
      },
    });

    const repository = new InMemorySecretRecordRepository();
    repository.seed(createServerSecretRecord());

    const metadataUseCase = new GetSecretMetadataUseCase({
      secretRecordRepository: repository,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const metadataResult = await metadataUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.readMetadata]),
      secretId: "secret:server:openai",
      occurredAt: "invalid-timestamp",
    });

    expect(metadataResult).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidRequest,
        message: "occurredAt must be a valid timestamp when provided.",
      },
    });
  });
});

function createServerAdminActor(
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return {
    actorId: "user:server-admin",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: actions,
  };
}

function createServerSecretRecord(): SecretRecord {
  return createSecretRecord({
    secretId: "secret:server:openai",
    name: "provider.openai.api-key",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    metadata: {
      displayName: "OpenAI API Key",
      description: "Primary OpenAI production key.",
      tags: ["openai", "prod"],
      labels: {
        provider: "openai",
        usage: "model-inference",
      },
    },
    createdAt: "2026-04-05T12:00:00.000Z",
    createdBy: "user:server-admin",
    initialVersion: {
      versionId: "secret:server:openai:v1",
      createdBy: "user:server-admin",
      encryptedPayloadRef: "enc:secret:server:openai:v1",
      payloadDigestSha256: "sha256:openai:v1",
      payloadByteLength: 14,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });
}
