import { SecretAccessActions, toSecretReference } from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import {
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretServiceErrorCodes,
  type RetrieveSecretPlaintextRequest,
  type RetrieveSecretPlaintextResult,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface RetrieveSecretPlaintextForRuntimeUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretEncryptionPort: ISecretEncryptionPort;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class RetrieveSecretPlaintextForRuntimeUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: RetrieveSecretPlaintextForRuntimeUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>> {
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

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        details: Object.freeze({
          reason: "invalid-occurredAt",
        }),
      });
      return invalidRequest("occurredAt must be a valid timestamp when provided.");
    }

    try {
      const record = await this.dependencies.secretRecordRepository.findSecretById(secretId);
      if (!record) {
        await this.emitOperation("missing", {
          occurredAt,
          actorId,
          secretId,
          details: Object.freeze({
            reason: "secret-not-found",
          }),
        });
        return notFound(secretId);
      }

      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.retrievePlaintext,
        actor: request.actor,
        owner: record.owner,
        record,
        occurredAt,
      });

      await this.dependencies.secretAccessAuditPort.recordSecretAccessDecision(Object.freeze({
        secretId: record.secretId,
        scope: record.owner.scope,
        action: SecretAccessActions.retrievePlaintext,
        decision: decision.allowed ? "allowed" : "denied",
        reason: decision.reason,
        actorId,
        actorType: request.actor.actorType,
        workspaceId: request.actor.workspaceId,
        userIdentityId: request.actor.userIdentityId,
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
      if (!currentVersion) {
        await this.emitOperation("failed", {
          occurredAt,
          actorId,
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
          details: Object.freeze({
            reason: "missing-current-version",
          }),
        });
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.invalidState,
            message: `Secret '${record.secretId}' is missing an active version.`,
          }),
        };
      }

      const decrypted = await this.dependencies.secretEncryptionPort.decryptSecretPlaintext({
        secretId: record.secretId,
        version: currentVersion,
      });

      await this.emitOperation("succeeded", {
        occurredAt,
        actorId,
        secretId: record.secretId,
        scope: record.owner.scope,
        workspaceId: record.owner.workspaceId,
        userIdentityId: record.owner.userIdentityId,
      });
      return {
        ok: true,
        value: Object.freeze({
          secret: toSecretReference(record),
          plaintext: decrypted.plaintext,
        }),
      };
    } catch {
      await this.emitOperation("failed", {
        occurredAt,
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
          message: "Secret plaintext retrieval failed due to an internal security error.",
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
    try {
      await this.observabilityPort.recordSecretOperation(Object.freeze({
        event: "secret.retrieve-plaintext",
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

function invalidRequest(message: string): SecretServiceResult<RetrieveSecretPlaintextResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function notFound(secretId: string): SecretServiceResult<RetrieveSecretPlaintextResult> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.notFound,
      message: `Secret '${secretId}' was not found.`,
    }),
  };
}
