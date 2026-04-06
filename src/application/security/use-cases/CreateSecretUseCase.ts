import {
  SecretAccessActions,
  SecretDomainError,
  SecretKinds,
  createSecretRecord,
  createSecretScopeOwner,
  toSecretReference,
} from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  SecretAccessAuditEvent,
} from "../ports/SecretServicePorts";
import {
  SecretServiceErrorCodes,
  type CreateSecretRequest,
  type CreateSecretResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface CreateSecretUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretEncryptionPort: ISecretEncryptionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly now?: () => Date;
}

export class CreateSecretUseCase {
  private readonly now: () => Date;

  public constructor(private readonly dependencies: CreateSecretUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>> {
    const occurredAt = normalizeTimestamp(request.createdAt, this.now);
    if (!occurredAt) {
      return invalidRequest("createdAt must be a valid timestamp when provided.");
    }

    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      return invalidRequest("actor.actorId is required.");
    }

    const operationKey = normalizeRequired(request.operationKey);
    if (!operationKey) {
      return invalidRequest("operationKey is required.");
    }

    const secretId = normalizeRequired(request.secretId);
    if (!secretId) {
      return invalidRequest("secretId is required.");
    }

    const name = normalizeRequired(request.name);
    if (!name) {
      return invalidRequest("name is required.");
    }

    const plaintext = normalizeRequired(request.plaintext);
    if (!plaintext) {
      return invalidRequest("plaintext is required.");
    }

    if (!Object.values(SecretKinds).includes(request.kind)) {
      return invalidRequest(`Secret kind '${String(request.kind)}' is not allowed.`);
    }

    let owner: ReturnType<typeof createSecretScopeOwner>;
    try {
      owner = createSecretScopeOwner(request.owner);
    } catch (error) {
      return invalidRequest(toErrorMessage(error));
    }

    const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
      action: SecretAccessActions.create,
      actor: request.actor,
      owner,
      occurredAt,
    });

    await emitAuditEvent(this.dependencies.secretAccessAuditPort, request, {
      secretId,
      scope: owner.scope,
      action: SecretAccessActions.create,
      decision: decision.allowed ? "allowed" : "denied",
      reason: decision.reason,
      occurredAt: decision.occurredAt,
    });

    if (!decision.allowed) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.accessDenied,
          message: `Secret create access denied (${decision.reason}).`,
        }),
      };
    }

    const existing = await this.dependencies.secretRecordRepository.findSecretByNameAndScope({
      name,
      owner,
    });
    if (existing) {
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.conflict,
          message: "Secret name already exists in the requested scope.",
          details: Object.freeze({
            secretId: existing.secretId,
            scope: owner.scope,
            workspaceId: owner.workspaceId,
            userIdentityId: owner.userIdentityId,
          }),
        }),
      };
    }

    try {
      const encryptedMaterial = await this.dependencies.secretEncryptionPort.encryptSecretPlaintext({
        secretId,
        owner,
        plaintext,
      });

      const createdRecord = createSecretRecord({
        secretId,
        name,
        owner,
        kind: request.kind,
        metadata: request.metadata,
        createdAt: occurredAt,
        createdBy: actorId,
        initialVersion: {
          versionId: `${secretId}:v1`,
          createdBy: actorId,
          encryptedPayloadRef: encryptedMaterial.encryptedPayloadRef,
          payloadDigestSha256: encryptedMaterial.payloadDigestSha256,
          payloadByteLength: encryptedMaterial.payloadByteLength,
          keyEncryptionContext: encryptedMaterial.keyEncryptionContext,
        },
      });

      const persisted = await this.dependencies.secretRecordRepository.createSecret({
        record: createdRecord,
        mutation: {
          operationKey,
          actorId,
          occurredAt,
        },
      });

      return {
        ok: true,
        value: Object.freeze({
          secret: toSecretReference(persisted.record),
        }),
      };
    } catch (error) {
      if (error instanceof SecretDomainError) {
        return invalidRequest(error.message);
      }

      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.internal,
          message: toErrorMessage(error),
        }),
      };
    }
  }
}

async function emitAuditEvent(
  auditPort: ISecretAccessAuditPort,
  request: CreateSecretRequest,
  input: Omit<SecretAccessAuditEvent, "actorId" | "actorType" | "workspaceId" | "userIdentityId">,
): Promise<void> {
  await auditPort.recordSecretAccessDecision(Object.freeze({
    ...input,
    actorId: request.actor.actorId,
    actorType: request.actor.actorType,
    workspaceId: request.actor.workspaceId,
    userIdentityId: request.actor.userIdentityId,
  }));
}

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized;
}

function normalizeTimestamp(value: string | undefined, now: () => Date): string | undefined {
  if (!value) {
    return now().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Secret create operation failed.";
}

function invalidRequest(message: string): SecretServiceResult<CreateSecretResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}
