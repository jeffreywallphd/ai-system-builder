import {
  SecretAccessActions,
  SecretDomainError,
  rotateSecretRecord,
  toSecretReference,
} from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import { SecretAuditEventKinds } from "../ports/SecretServicePorts";
import {
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretServiceErrorCodes,
  type RotateSecretRequest,
  type RotateSecretResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface RotateSecretUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretEncryptionPort: ISecretEncryptionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class RotateSecretUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: RotateSecretUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: RotateSecretRequest): Promise<SecretServiceResult<RotateSecretResult>> {
    const actorId = normalizeRequired(request.actor?.actorId);
    if (!actorId) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        secretId: request.secretId,
        details: Object.freeze({
          reason: "missing-actorId",
        }),
      });
      return invalidRequest("actor.actorId is required.");
    }

    const operationKey = normalizeRequired(request.operationKey);
    if (!operationKey) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId: request.secretId,
        details: Object.freeze({
          reason: "missing-operationKey",
        }),
      });
      return invalidRequest("operationKey is required.");
    }

    const secretId = normalizeRequired(request.secretId);
    if (!secretId) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        details: Object.freeze({
          reason: "missing-secretId",
        }),
      });
      return invalidRequest("secretId is required.");
    }

    const plaintext = normalizeRequired(request.plaintext);
    if (!plaintext) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        details: Object.freeze({
          reason: "missing-plaintext",
        }),
      });
      return invalidRequest("plaintext is required.");
    }

    const rotatedAt = normalizeTimestamp(request.rotatedAt, this.now);
    if (!rotatedAt) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        details: Object.freeze({
          reason: "invalid-rotatedAt",
        }),
      });
      return invalidRequest("rotatedAt must be a valid timestamp when provided.");
    }

    try {
      const record = await this.dependencies.secretRecordRepository.findSecretById(secretId);
      if (!record) {
        await this.emitOperation("missing", {
          occurredAt: rotatedAt,
          actorId,
          secretId,
          details: Object.freeze({
            reason: "secret-not-found",
          }),
        });
        return notFound(secretId);
      }

      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.rotate,
        actor: request.actor,
        owner: record.owner,
        record,
        occurredAt: rotatedAt,
      });
      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.accessDecision,
        action: SecretAccessActions.rotate,
        decision: decision.allowed ? "allowed" : "denied",
        reason: decision.reason,
        actor: Object.freeze({
          actorId,
          actorType: request.actor.actorType,
          workspaceId: request.actor.workspaceId,
          userIdentityId: request.actor.userIdentityId,
        }),
        target: Object.freeze({
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
        }),
        occurredAt: decision.occurredAt,
      }));

      if (!decision.allowed) {
        await this.emitOperation("denied", {
          occurredAt: decision.occurredAt,
          actorId,
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
          details: Object.freeze({
            reason: decision.reason,
          }),
        });
        return notFound(secretId);
      }

      const currentVersion = record.versions.find((version) => version.versionId === record.currentVersionId);
      const encrypted = await this.dependencies.secretEncryptionPort.encryptSecretPlaintext({
        secretId: record.secretId,
        owner: record.owner,
        plaintext,
        existingContext: currentVersion?.keyEncryptionContext,
      });

      const rotatedRecord = rotateSecretRecord({
        record,
        rotatedBy: actorId,
        rotatedAt,
        nextVersion: {
          versionId: `${record.secretId}:v${record.versions.length + 1}`,
          createdBy: actorId,
          encryptedPayloadRef: encrypted.encryptedPayloadRef,
          payloadDigestSha256: encrypted.payloadDigestSha256,
          payloadByteLength: encrypted.payloadByteLength,
          keyEncryptionContext: encrypted.keyEncryptionContext,
        },
      });

      const persisted = await this.dependencies.secretRecordRepository.saveSecret(rotatedRecord, {
        operationKey,
        actorId,
        occurredAt: rotatedAt,
      });
      await this.emitOperation("succeeded", {
        occurredAt: rotatedAt,
        actorId,
        secretId: persisted.record.secretId,
        scope: persisted.record.owner.scope,
        workspaceId: persisted.record.owner.workspaceId,
        userIdentityId: persisted.record.owner.userIdentityId,
        details: Object.freeze({
          changed: persisted.changed,
          wasReplay: persisted.wasReplay,
        }),
      });

      return {
        ok: true,
        value: Object.freeze({
          secret: toSecretReference(persisted.record),
          currentVersionId: persisted.record.currentVersionId ?? "",
        }),
      };
    } catch (error) {
      if (error instanceof SecretDomainError) {
        await this.emitOperation("rejected", {
          occurredAt: rotatedAt,
          actorId,
          secretId,
          details: Object.freeze({
            reason: "domain-validation-failed",
          }),
        });
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.invalidState,
            message: error.message,
          }),
        };
      }

      await this.emitOperation("failed", {
        occurredAt: rotatedAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "internal-error",
        }),
      });
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.internal,
          message: "Secret rotation failed due to an internal security error.",
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
      readonly scope?: ReturnType<typeof toSecretReference>["scope"];
      readonly workspaceId?: string;
      readonly userIdentityId?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    },
  ): Promise<void> {
    const reasonCode = resolveReasonCode(outcome, input.details);
    try {
      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.operation,
        operation: SecretAccessActions.rotate,
        status: SecretOperationalOutcomes[outcome],
        reasonCode,
        actor: Object.freeze({
          actorId: input.actorId ?? "unknown",
        }),
        target: Object.freeze({
          secretId: input.secretId,
          scope: input.scope,
          workspaceId: input.workspaceId,
          userIdentityId: input.userIdentityId,
        }),
        occurredAt: input.occurredAt,
      }));
    } catch {
      // Audit failures are intentionally non-fatal.
    }
    try {
      await this.observabilityPort.recordSecretOperation(Object.freeze({
        event: "secret.rotate",
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

function normalizeRequired(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
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

function invalidRequest(message: string): SecretServiceResult<RotateSecretResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function notFound(secretId: string): SecretServiceResult<RotateSecretResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.notFound,
      message: `Secret '${secretId}' was not found.`,
    }),
  };
}

function resolveReasonCode(
  outcome: keyof typeof SecretOperationalOutcomes,
  details: Readonly<Record<string, unknown>> | undefined,
): string {
  const detailReason = details?.reason;
  if (typeof detailReason === "string" && detailReason.trim()) {
    return detailReason.trim();
  }
  if (outcome === "succeeded") {
    return "operation-succeeded";
  }
  if (outcome === "missing") {
    return "secret-not-found";
  }
  return "operation-outcome";
}
