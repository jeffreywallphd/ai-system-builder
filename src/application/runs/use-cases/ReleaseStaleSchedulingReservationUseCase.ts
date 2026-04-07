import { randomUUID } from "node:crypto";
import type { AuthoritativeAuditRecordingPort } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type { PlatformAuditEventRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { PlatformAuditEventKinds } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { AuditActorKinds, AuditEventOutcomes, AuditScopeKinds } from "@domain/audit/AuditDomain";

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ReleaseStaleSchedulingReservationValidationError(`${label} is required.`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIso(value: string | undefined, fallback: string): string {
  const candidate = normalizeOptional(value) ?? fallback;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) {
    throw new ReleaseStaleSchedulingReservationValidationError("releasedAt must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

export class ReleaseStaleSchedulingReservationValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReleaseStaleSchedulingReservationValidationError";
  }
}

export class ReleaseStaleSchedulingReservationNotFoundError extends Error {
  public constructor(runId: string) {
    super(`Run '${runId}' does not have a releasable stale reservation.`);
    this.name = "ReleaseStaleSchedulingReservationNotFoundError";
  }
}

export class ReleaseStaleSchedulingReservationConflictError extends Error {
  public constructor(runId: string) {
    super(`Run '${runId}' reservation release conflicted with current queue state.`);
    this.name = "ReleaseStaleSchedulingReservationConflictError";
  }
}

export interface ReleaseStaleSchedulingReservationRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly runId: string;
  readonly claimToken: string;
  readonly releasedAt?: string;
  readonly reason?: string;
  readonly correlationId?: string;
}

export interface ReleaseStaleSchedulingReservationResult {
  readonly runId: string;
  readonly queueId: string;
  readonly releasedAt: string;
  readonly staleSeconds: number;
  readonly reservationOwner: string;
  readonly mutationId: string;
}

export class ReleaseStaleSchedulingReservationUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: { readonly nextId: (prefix: string) => string };

  public constructor(
    private readonly dependencies: {
      readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
      readonly orchestrationIntentRepository: IRunOrchestrationIntentRepository;
      readonly now?: () => Date;
      readonly idGenerator?: { readonly nextId: (prefix: string) => string };
      readonly authoritativeAuditRecorder?: Pick<AuthoritativeAuditRecordingPort, "recordRunsEvent">;
    },
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async execute(input: ReleaseStaleSchedulingReservationRequest): Promise<ReleaseStaleSchedulingReservationResult> {
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const runId = normalizeRequired(input.runId, "runId");
    const claimToken = normalizeRequired(input.claimToken, "claimToken");
    const releasedAt = normalizeIso(input.releasedAt, this.now().toISOString());
    const reason = normalizeOptional(input.reason);
    const correlationId = normalizeOptional(input.correlationId);

    const queueEntry = await this.dependencies.queueRepository.getQueueEntryByRunId(runId);
    if (!queueEntry || queueEntry.workspaceId !== workspaceId || !queueEntry.claimToken || !queueEntry.claimExpiresAt || !queueEntry.claimedBy) {
      throw new ReleaseStaleSchedulingReservationNotFoundError(runId);
    }
    if (queueEntry.claimToken !== claimToken) {
      throw new ReleaseStaleSchedulingReservationNotFoundError(runId);
    }
    if (Date.parse(queueEntry.claimExpiresAt) > Date.parse(releasedAt)) {
      throw new ReleaseStaleSchedulingReservationValidationError("Only stale reservations can be released.");
    }

    const released = await this.dependencies.queueRepository.releaseRunClaim({
      runId,
      claimToken,
      releasedAt,
    });
    if (!released) {
      throw new ReleaseStaleSchedulingReservationConflictError(runId);
    }

    const staleSeconds = Math.max(0, Math.floor((Date.parse(releasedAt) - Date.parse(queueEntry.claimExpiresAt)) / 1000));
    const mutationId = this.idGenerator.nextId("run:scheduling-admin-release-stale-reservation");
    await this.appendAuditEvent({
      workspaceId,
      runId,
      actorUserIdentityId,
      reservationOwner: queueEntry.claimedBy,
      claimToken,
      claimExpiresAt: queueEntry.claimExpiresAt,
      releasedAt,
      staleSeconds,
      reason,
      mutationId,
      correlationId,
    });

    return Object.freeze({
      runId,
      queueId: queueEntry.queueId,
      releasedAt,
      staleSeconds,
      reservationOwner: queueEntry.claimedBy,
      mutationId,
    });
  }

  private async appendAuditEvent(input: {
    readonly workspaceId: string;
    readonly runId: string;
    readonly actorUserIdentityId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly claimExpiresAt: string;
    readonly releasedAt: string;
    readonly staleSeconds: number;
    readonly reason?: string;
    readonly mutationId: string;
    readonly correlationId?: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.scheduling.admin.stale-reservation.released",
      actorId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      targetRef: `run:${input.runId}`,
      outcome: "succeeded",
      occurredAt: input.releasedAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        mutationId: input.mutationId,
        reservationOwner: input.reservationOwner,
        claimToken: input.claimToken,
        claimExpiresAt: input.claimExpiresAt,
        staleSeconds: input.staleSeconds,
        reason: input.reason,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:scheduling-admin:release-stale-reservation:${input.runId}:${event.eventId}`,
      actorId: input.actorUserIdentityId,
      occurredAt: input.releasedAt,
      correlationId: input.correlationId,
    });

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:scheduling-admin:release-stale-reservation:${input.runId}:${input.mutationId}`,
        eventType: "run-scheduling-admin-stale-reservation-released",
        action: "run.scheduling.admin.stale-reservation.released",
        outcome: AuditEventOutcomes.succeeded,
        occurredAt: input.releasedAt,
        actor: Object.freeze({
          actorId: input.actorUserIdentityId,
          actorKind: AuditActorKinds.user,
          actorUserIdentityId: input.actorUserIdentityId,
        }),
        scope: Object.freeze({
          kind: AuditScopeKinds.workspace,
          workspaceId: input.workspaceId,
        }),
        protectedResource: Object.freeze({
          resourceType: "run",
          resourceId: input.runId,
          resourceRef: input.runId.startsWith("run:") ? input.runId : `run:${input.runId}`,
          sensitivityClass: "sensitive",
          workspaceId: input.workspaceId,
        }),
        correlationId: input.correlationId,
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            mutationId: input.mutationId,
            reservationOwner: input.reservationOwner,
            staleSeconds: input.staleSeconds,
            reasonCode: "stale-reservation-released",
          }),
          adminOnlyDetails: Object.freeze({
            claimToken: input.claimToken,
            claimExpiresAt: input.claimExpiresAt,
            reason: input.reason,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail scheduling-admin behavior.
    }
  }
}

