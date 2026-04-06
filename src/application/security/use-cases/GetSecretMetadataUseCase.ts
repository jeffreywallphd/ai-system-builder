import { SecretAccessActions, toSecretReference } from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
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
  type GetSecretMetadataRequest,
  type SecretServiceResult,
} from "./SecretManagementServiceContracts";
import { toGetSecretMetadataRequestDiagnosticDto } from "../../../shared/dto/security/SecretServiceDtos";

export interface GetSecretMetadataUseCaseDependencies {
  readonly secretRecordRepository: ISecretRecordPersistenceRepository;
  readonly secretAccessPolicyPort: ISecretAccessPolicyPort;
  readonly secretAccessAuditPort: ISecretAccessAuditPort;
  readonly secretObservabilityPort?: ISecretObservabilityPort;
  readonly now?: () => Date;
}

export class GetSecretMetadataUseCase {
  private readonly now: () => Date;
  private readonly observabilityPort: ISecretObservabilityPort;

  public constructor(private readonly dependencies: GetSecretMetadataUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observabilityPort = dependencies.secretObservabilityPort ?? new NoOpSecretObservabilityPort();
  }

  public async execute(request: GetSecretMetadataRequest): Promise<SecretServiceResult<ReturnType<typeof toSecretReference>>> {
    const diagnostics = toGetSecretMetadataRequestDiagnosticDto(request);
    const actorId = request.actor?.actorId?.trim();
    if (!actorId) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId: diagnostics.actor.actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "missing-actorId",
          request: diagnostics,
        }),
      });
      return invalidRequest("actor.actorId is required.");
    }

    const secretId = request.secretId?.trim();
    if (!secretId) {
      await this.emitOperation("rejected", {
        occurredAt: this.now().toISOString(),
        actorId,
        secretId: diagnostics.secretId,
        details: Object.freeze({
          reason: "missing-secretId",
          request: diagnostics,
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
          request: diagnostics,
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
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.notFound,
            message: `Secret '${secretId}' was not found.`,
          }),
        };
      }

      const decision = await this.dependencies.secretAccessPolicyPort.evaluateSecretAccess({
        action: SecretAccessActions.readMetadata,
        actor: request.actor,
        owner: record.owner,
        record,
        occurredAt,
      });

      await this.dependencies.secretAccessAuditPort.recordSecretAuditEvent(Object.freeze({
        eventKind: SecretAuditEventKinds.accessDecision,
        action: SecretAccessActions.readMetadata,
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
        return {
          ok: false,
          error: Object.freeze({
            code: SecretServiceErrorCodes.accessDenied,
            message: `Secret metadata access denied (${decision.reason}).`,
          }),
        };
      }

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
        value: toSecretReference(record),
      };
    } catch {
      await this.emitOperation("failed", {
        occurredAt,
        actorId,
        secretId,
        details: Object.freeze({
          reason: "internal-error",
          request: diagnostics,
        }),
      });
      return {
        ok: false,
        error: Object.freeze({
          code: SecretServiceErrorCodes.internal,
          message: "Secret metadata lookup failed due to an internal security error.",
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
        operation: SecretAccessActions.readMetadata,
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
        event: "secret.read-metadata",
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
