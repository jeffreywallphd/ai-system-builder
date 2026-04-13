import {
  SecretAccessActions,
  SecretActorTypes,
  createSecretScopeOwner,
  type SecretScopeOwner,
} from "@domain/security/SecretDomain";
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

    const operationKey = normalizeRequired(request.operationKey);
    if (!operationKey) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        details: Object.freeze({
          reason: "missing-operationKey",
        }),
      });
      return invalidRequest("operationKey is required.");
    }

    const serviceIdentity = normalizeRequired(request.runtimeContext?.serviceIdentity);
    if (!serviceIdentity) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        operationKey,
        details: Object.freeze({
          reason: "missing-runtime-serviceIdentity",
        }),
      });
      return invalidRequest("runtimeContext.serviceIdentity is required.");
    }

    const justification = normalizeRequired(request.runtimeContext?.justification);
    if (!justification) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        operationKey,
        serviceIdentity,
        details: Object.freeze({
          reason: "missing-runtime-justification",
        }),
      });
      return invalidRequest("runtimeContext.justification is required.");
    }

    let requestedScope: SecretScopeOwner;
    try {
      requestedScope = createSecretScopeOwner(request.runtimeContext.scope);
    } catch (error) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        operationKey,
        serviceIdentity,
        details: Object.freeze({
          reason: "invalid-runtime-scope",
          error: toErrorMessage(error),
        }),
      });
      return invalidRequest("runtimeContext.scope is invalid.");
    }

    if (!isRuntimeActorType(request.actor.actorType)) {
      const occurredAt = this.now().toISOString();
      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.accessDecision,
        action: SecretAccessActions.retrievePlaintext,
        decision: "denied",
        reason: "runtime-access-required",
        operationKey,
        serviceIdentity,
        justification,
        actor: Object.freeze({
          actorId,
          actorType: request.actor.actorType,
          workspaceId: request.actor.workspaceId,
          userIdentityId: request.actor.userIdentityId,
        }),
        target: Object.freeze({
          secretId,
          scope: requestedScope.scope,
          workspaceId: requestedScope.workspaceId,
          userIdentityId: requestedScope.userIdentityId,
        }),
        occurredAt,
      }));
      await this.emitOperation("denied", {
        occurredAt,
        actorId,
        secretId,
        scope: requestedScope.scope,
        workspaceId: requestedScope.workspaceId,
        userIdentityId: requestedScope.userIdentityId,
        operationKey,
        serviceIdentity,
        details: Object.freeze({
          reason: "runtime-access-required",
          operationKey,
          serviceIdentity,
        }),
      });
      return notFound(secretId);
    }

    const occurredAt = normalizeTimestamp(request.occurredAt, this.now);
    if (!occurredAt) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId,
        operationKey,
        serviceIdentity,
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

      if (!isSameScopeOwner(record.owner, requestedScope)) {
        await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
          eventKind: SecretAuditEventKinds.accessDecision,
          action: SecretAccessActions.retrievePlaintext,
          decision: "denied",
          reason: "scope-mismatch",
          operationKey,
          serviceIdentity,
          justification,
          actor: Object.freeze({
            actorId,
            actorType: request.actor.actorType,
            workspaceId: request.actor.workspaceId,
            userIdentityId: request.actor.userIdentityId,
          }),
          target: Object.freeze({
            secretId,
            scope: requestedScope.scope,
            workspaceId: requestedScope.workspaceId,
            userIdentityId: requestedScope.userIdentityId,
          }),
          occurredAt,
        }));
        await this.emitOperation("denied", {
          occurredAt,
          actorId,
          secretId,
          scope: requestedScope.scope,
          workspaceId: requestedScope.workspaceId,
          userIdentityId: requestedScope.userIdentityId,
          details: Object.freeze({
            reason: "runtime-scope-reference-mismatch",
            operationKey,
            serviceIdentity,
          }),
        });
        return notFound(secretId);
      }

      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.retrievePlaintext,
        actor: request.actor,
        owner: requestedScope,
        record,
        occurredAt,
      });

      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.accessDecision,
        action: SecretAccessActions.retrievePlaintext,
        decision: decision.allowed ? "allowed" : "denied",
        reason: decision.reason,
        operationKey,
        serviceIdentity,
        justification,
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
          operationKey,
          serviceIdentity,
          details: Object.freeze({
            reason: decision.reason,
            operationKey,
            serviceIdentity,
          }),
        });
        return notFound(secretId);
      }

      const requestedVersionId = normalizeRequired(request.runtimeContext.versionId);
      const allowSupersededVersion = request.runtimeContext.allowSupersededVersion === true;
      const currentVersion = record.versions.find((version) => version.versionId === record.currentVersionId);
      if (!currentVersion) {
        await this.emitOperation("failed", {
          occurredAt,
          actorId,
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
          operationKey,
          serviceIdentity,
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

      const resolvedVersion = requestedVersionId
        ? record.versions.find((version) => version.versionId === requestedVersionId)
        : currentVersion;
      if (!resolvedVersion) {
        await this.emitOperation("missing", {
          occurredAt,
          actorId,
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
          operationKey,
          serviceIdentity,
          details: Object.freeze({
            reason: "secret-version-not-found",
          }),
        });
        return notFound(secretId);
      }

      if (
        resolvedVersion.state !== "active"
        && !(allowSupersededVersion && resolvedVersion.state === "superseded")
      ) {
        await this.emitOperation("denied", {
          occurredAt,
          actorId,
          secretId: record.secretId,
          scope: record.owner.scope,
          workspaceId: record.owner.workspaceId,
          userIdentityId: record.owner.userIdentityId,
          operationKey,
          serviceIdentity,
          details: Object.freeze({
            reason: "secret-version-state-not-allowed",
            requestedVersionId: resolvedVersion.versionId,
            requestedVersionState: resolvedVersion.state,
          }),
        });
        return notFound(secretId);
      }

      const decrypted = await this.dependencies.secretEncryptionPort.decryptSecretPlaintext({
        secretId: record.secretId,
        version: resolvedVersion,
      });

      await this.emitOperation("succeeded", {
        occurredAt,
        actorId,
        secretId: record.secretId,
        scope: record.owner.scope,
        workspaceId: record.owner.workspaceId,
        userIdentityId: record.owner.userIdentityId,
        operationKey,
        serviceIdentity,
      });
      return {
        ok: true,
        value: Object.freeze({
          secretId: record.secretId,
          currentVersionId: currentVersion.versionId,
          scope: record.owner,
          plaintext: decrypted.plaintext,
        }),
      };
    } catch {
      await this.emitOperation("failed", {
        occurredAt,
        actorId,
        secretId,
        operationKey,
        serviceIdentity,
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

  public async retrieveSecretPlaintextForRuntime(
    request: RetrieveSecretPlaintextRequest,
  ): Promise<SecretServiceResult<RetrieveSecretPlaintextResult>> {
    return this.execute(request);
  }

  private async emitOperation(
    outcome: keyof typeof SecretOperationalOutcomes,
    input: {
      readonly occurredAt: string;
      readonly actorId?: string;
      readonly secretId?: string;
      readonly scope?: SecretScopeOwner["scope"];
      readonly workspaceId?: string;
      readonly userIdentityId?: string;
      readonly operationKey?: string;
      readonly serviceIdentity?: string;
      readonly details?: Readonly<Record<string, unknown>>;
    },
  ): Promise<void> {
    const reasonCode = resolveReasonCode(outcome, input.details);
    try {
      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.operation,
        operation: SecretAccessActions.retrievePlaintext,
        status: SecretOperationalOutcomes[outcome],
        reasonCode,
        operationKey: input.operationKey,
        serviceIdentity: input.serviceIdentity,
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

function isRuntimeActorType(value: string): boolean {
  return value === SecretActorTypes.serverRuntime || value === SecretActorTypes.workspaceService;
}

function isSameScopeOwner(left: SecretScopeOwner, right: SecretScopeOwner): boolean {
  return left.scope === right.scope
    && left.workspaceId === right.workspaceId
    && left.userIdentityId === right.userIdentityId;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "unknown-error";
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
