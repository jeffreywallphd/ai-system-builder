import {
  SecretAccessActions,
  SecretDomainError,
  disableSecretRecord,
  toSecretReference,
} from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretRecordPersistenceRepository,
} from "../ports/SecretServicePorts";
import {
  NoOpSecretObservabilityPort,
  SecretOperationalOutcomes,
  type ISecretObservabilityPort,
} from "../ports/SecretObservabilityPorts";
import {
  SecretServiceErrorCodes,
  type DisableSecretRequest,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";

export interface DisableSecretUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class DisableSecretUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: DisableSecretUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: DisableSecretRequest): Promise<SecretServiceResult<ReturnType<typeof toSecretReference>>> {
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

    const disabledAt = normalizeTimestamp(request.disabledAt, this.now);
    if (!disabledAt) {
      return invalidRequest("disabledAt must be a valid timestamp when provided.");
    }

    try {
      const record = await this.dependencies.secretRecordRepository.findSecretById(secretId);
      if (!record) {
        return notFound(secretId);
      }

      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.disable,
        actor: request.actor,
        owner: record.owner,
        record,
        occurredAt: disabledAt,
      });
      await this.dependencies.secretAccessAuditPort.recordSecretAccessDecision(Object.freeze({
        secretId: record.secretId,
        scope: record.owner.scope,
        action: SecretAccessActions.disable,
        decision: decision.allowed ? "allowed" : "denied",
        reason: decision.reason,
        actorId,
        actorType: request.actor.actorType,
        workspaceId: request.actor.workspaceId,
        userIdentityId: request.actor.userIdentityId,
        occurredAt: decision.occurredAt,
      }));

      if (!decision.allowed) {
        return notFound(secretId);
      }

      const disabled = disableSecretRecord({
        record,
        disabledAt,
        disabledBy: actorId,
      });
      const persisted = await this.dependencies.secretRecordRepository.saveSecret(disabled, {
        operationKey,
        actorId,
        occurredAt: disabledAt,
      });

      await this.emitOperation("succeeded", {
        occurredAt: disabledAt,
        actorId,
        secretId: persisted.record.secretId,
        scope: persisted.record.owner.scope,
        workspaceId: persisted.record.owner.workspaceId,
        userIdentityId: persisted.record.owner.userIdentityId,
      });
      return {
        ok: true,
        value: toSecretReference(persisted.record),
      };
    } catch (error) {
      if (error instanceof SecretDomainError) {
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.invalidState,
            message: error.message,
          }),
        };
      }

      await this.emitOperation("failed", {
        occurredAt: disabledAt,
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
          message: "Secret disable operation failed due to an internal security error.",
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
        event: "secret.disable",
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

function invalidRequest(message: string): SecretServiceResult<ReturnType<typeof toSecretReference>> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.invalidRequest,
      message,
    }),
  };
}

function notFound(secretId: string): SecretServiceResult<ReturnType<typeof toSecretReference>> {
  return {
    ok: false,
    error: Object.freeze({
      code: SecretServiceErrorCodes.notFound,
      message: `Secret '${secretId}' was not found.`,
    }),
  };
}
