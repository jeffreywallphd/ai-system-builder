import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  createSecretRecord,
  evaluateSecretAccessDecision,
  rotateSecretRecord,
  type SecretAccessActor,
  type SecretRecord,
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
import { RetrieveSecretPlaintextForRuntimeUseCase } from "../use-cases/RetrieveSecretPlaintextForRuntimeUseCase";
import { RetireSecretVersionUseCase } from "../use-cases/RetireSecretVersionUseCase";
import { RevokeSecretVersionUseCase } from "../use-cases/RevokeSecretVersionUseCase";
import { SecretServiceErrorCodes } from "../use-cases/SecretManagementServiceContracts";

class InMemorySecretRecordRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  public async findSecretByNameAndScope(_input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
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
    const prior = this.records.get(record.secretId);
    this.records.set(record.secretId, record);
    return {
      changed: JSON.stringify(prior) !== JSON.stringify(record),
      wasReplay: false,
      record,
    };
  }

  public async deleteSecret(
    _secretId: string,
    _mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult> {
    return {
      changed: false,
      wasReplay: false,
    };
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  private readonly plaintextByPayloadRef = new Map<string, string>();

  public seedPayload(payloadRef: string, plaintext: string): void {
    this.plaintextByPayloadRef.set(payloadRef, plaintext);
  }

  public async encryptSecretPlaintext(): Promise<never> {
    throw new Error("not used in this test");
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

describe("Secret version lifecycle use cases", () => {
  it("revokes a superseded version while keeping the active version available for runtime resolution", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const revokeUseCase = new RevokeSecretVersionUseCase({
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

    const seeded = createSeededServerRecord();
    repository.seed(seeded.record);
    encryption.seedPayload(seeded.payloads.v1.ref, seeded.payloads.v1.plaintext);
    encryption.seedPayload(seeded.payloads.v2.ref, seeded.payloads.v2.plaintext);

    const revoked = await revokeUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.revokeVersion]),
      operationKey: "op:secret:revoke-version",
      secretId: seeded.record.secretId,
      versionId: `${seeded.record.secretId}:v1`,
      reason: "suspected historical exposure",
      revokedAt: "2026-04-12T00:01:00.000Z",
    });

    expect(revoked.ok).toBeTrue();
    if (!revoked.ok) {
      return;
    }
    expect(revoked.value.currentVersionId).toBe(`${seeded.record.secretId}:v2`);

    const persisted = await repository.findSecretById(seeded.record.secretId);
    expect(persisted?.versions.map((version) => version.state)).toEqual(["revoked", "active"]);
    expect(persisted?.currentVersionId).toBe(`${seeded.record.secretId}:v2`);

    const retrieved = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: seeded.record.secretId,
      operationKey: "op:secret:retrieve-active",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "runtime provider call",
      },
    });

    expect(retrieved).toEqual({
      ok: true,
      value: {
        secretId: seeded.record.secretId,
        currentVersionId: `${seeded.record.secretId}:v2`,
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: seeded.payloads.v2.plaintext,
      },
    });
  });

  it("retires the active version and prevents default runtime retrieval when no active version remains", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const retireUseCase = new RetireSecretVersionUseCase({
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

    const seeded = createSeededServerRecord();
    repository.seed(seeded.record);
    encryption.seedPayload(seeded.payloads.v1.ref, seeded.payloads.v1.plaintext);
    encryption.seedPayload(seeded.payloads.v2.ref, seeded.payloads.v2.plaintext);

    const retired = await retireUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.retireVersion]),
      operationKey: "op:secret:retire-version",
      secretId: seeded.record.secretId,
      versionId: `${seeded.record.secretId}:v2`,
      reason: "planned decommission after cutover",
      retiredAt: "2026-04-12T00:03:00.000Z",
    });

    expect(retired.ok).toBeTrue();
    if (!retired.ok) {
      return;
    }
    expect(retired.value.currentVersionId).toBeUndefined();

    const persisted = await repository.findSecretById(seeded.record.secretId);
    expect(persisted?.versions.map((version) => version.state)).toEqual(["superseded", "retired"]);
    expect(persisted?.currentVersionId).toBeUndefined();

    const retrieved = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: seeded.record.secretId,
      operationKey: "op:secret:retrieve-after-retire",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "runtime provider call",
      },
    });

    expect(retrieved).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.invalidState,
        message: `Secret '${seeded.record.secretId}' is missing an active version.`,
      },
    });
  });
});

function createSeededServerRecord(): {
  readonly record: SecretRecord;
  readonly payloads: {
    readonly v1: { readonly ref: string; readonly plaintext: string };
    readonly v2: { readonly ref: string; readonly plaintext: string };
  };
} {
  const v1PayloadRef = "enc:secret:server:revocation-test:v1";
  const v2PayloadRef = "enc:secret:server:revocation-test:v2";
  const created = createSecretRecord({
    secretId: "secret:server:revocation-test",
    name: "provider.openai.revocation-test",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    createdBy: "user:server-admin",
    createdAt: "2026-04-11T00:00:00.000Z",
    metadata: {
      tags: ["server", "rotation"],
      labels: {
        provider: "openai",
      },
    },
    initialVersion: {
      versionId: "secret:server:revocation-test:v1",
      createdBy: "user:server-admin",
      encryptedPayloadRef: v1PayloadRef,
      payloadDigestSha256: "sha256:secret:server:revocation-test:v1",
      payloadByteLength: 8,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });

  const rotated = rotateSecretRecord({
    record: created,
    rotatedBy: "user:server-admin",
    rotatedAt: "2026-04-11T00:05:00.000Z",
    nextVersion: {
      versionId: "secret:server:revocation-test:v2",
      createdBy: "user:server-admin",
      encryptedPayloadRef: v2PayloadRef,
      payloadDigestSha256: "sha256:secret:server:revocation-test:v2",
      payloadByteLength: 8,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });

  return Object.freeze({
    record: rotated,
    payloads: Object.freeze({
      v1: Object.freeze({
        ref: v1PayloadRef,
        plaintext: "sk-v1",
      }),
      v2: Object.freeze({
        ref: v2PayloadRef,
        plaintext: "sk-v2",
      }),
    }),
  });
}

function createServerAdminActor(
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return {
    actorId: "user:server-admin",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: actions,
  };
}
