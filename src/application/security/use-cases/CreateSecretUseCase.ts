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
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretServiceErrorCodes,
  type CreateSecretRequest,
  type CreateSecretResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";
import { toCreateSecretRequestDiagnosticDto, toSecretOwnerDiagnosticDto } from "../../../shared/dto/security/SecretServiceDtos";

export interface CreateSecretUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretEncryptionPort: ISecretEncryptionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class CreateSecretUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: CreateSecretUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: CreateSecretRequest): Promise<SecretServiceResult<CreateSecretResult>> {
    const occurredAt = normalizeTimestamp(request.createdAt, this.now);
    const diagnostics = toCreateSecretRequestDiagnosticDto(request);
    if (!occurredAt) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId: diagnostics.actor.actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "invalid-createdAt",
          request: diagnostics,
        }),
      });
      return invalidRequest("createdAt must be a valid timestamp when provided.");
    }

    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId: diagnostics.actor.actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "missing-actorId",
          request: diagnostics,
        }),
      });
      return invalidRequest("actor.actorId is required.");
    }

    const operationKey = normalizeRequired(request.operationKey);
    if (!operationKey) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "missing-operationKey",
          request: diagnostics,
        }),
      });
      return invalidRequest("operationKey is required.");
    }

    const secretId = normalizeRequired(request.secretId);
    if (!secretId) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "missing-secretId",
          request: diagnostics,
        }),
      });
      return invalidRequest("secretId is required.");
    }

    const name = normalizeRequired(request.name);
    if (!name) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "missing-name",
          request: diagnostics,
        }),
      });
      return invalidRequest("name is required.");
    }

    const plaintext = normalizeRequired(request.plaintext);
    if (!plaintext) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "missing-plaintext",
          request: diagnostics,
        }),
      });
      return invalidRequest("plaintext is required.");
    }

    if (!Object.values(SecretKinds).includes(request.kind)) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "invalid-kind",
          request: diagnostics,
        }),
      });
      return invalidRequest(`Secret kind '${String(request.kind)}' is not allowed.`);
    }

    let owner: ReturnType<typeof createSecretScopeOwner>;
    try {
      owner = createSecretScopeOwner(request.owner);
    } catch (error) {
      await this.emitOperation("rejected", {
        occurredAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "invalid-owner",
          owner: request.owner,
          request: diagnostics,
        }),
      });
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
      await this.emitOperation("denied", {
        occurredAt: decision.occurredAt,
        actorId,
        secretId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
        details: Object.freeze({
          reason: decision.reason,
        }),
      });
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
      await this.emitOperation("conflict", {
        occurredAt,
        actorId,
        secretId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
        details: Object.freeze({
          existingSecretId: existing.secretId,
        }),
      });
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
      await this.emitOperation("succeeded", {
        occurredAt,
        actorId,
        secretId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
        details: Object.freeze({
          owner: toSecretOwnerDiagnosticDto(owner),
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          secret: toSecretReference(persisted.record),
        }),
      };
    } catch (error) {
      if (error instanceof SecretDomainError) {
        await this.emitOperation("rejected", {
          occurredAt,
          actorId,
          secretId,
          scope: owner.scope,
          workspaceId: owner.workspaceId,
          userIdentityId: owner.userIdentityId,
          details: Object.freeze({
            reason: "domain-validation-failed",
            request: diagnostics,
          }),
        });
        return invalidRequest(error.message);
      }

      await this.emitOperation("failed", {
        occurredAt,
        actorId,
        secretId,
        scope: owner.scope,
        workspaceId: owner.workspaceId,
        userIdentityId: owner.userIdentityId,
        details: Object.freeze({
          reason: "internal-error",
          request: diagnostics,
        }),
      });
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.internal,
          message: "Secret create operation failed due to an internal security error.",
        }),
      };
    }
  }

  private async emitOperation(
    outcome: keyof typeof SecretOperationalOutcomes,
    input: {
      readonly occurredAt: string;
      readonly actorId?: string;
      readonly secretId?: string;
      readonly scope?: ReturnType<typeof createSecretScopeOwner>["scope"];
      readonly workspaceId?: string;
      readonly userIdentityId?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    },
  ): Promise<void> {
    try {
      await this.observabilityPort.recordSecretOperation(Object.freeze({
        event: "secret.create",
        outcome: SecretOperationalOutcomes[outcome],
        occurredAt: input.occurredAt,
        actorId: input.actorId,
        secretId: input.secretId,
        scope: input.scope,
        workspaceId: input.workspaceId,
        userIdentityId: input.userIdentityId,
        details: input.details,
      }));
    } catch {
      // Observability failures are intentionally non-fatal.
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
