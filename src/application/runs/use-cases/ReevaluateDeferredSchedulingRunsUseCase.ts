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
    throw new ReevaluateDeferredSchedulingRunsValidationError(`${label} is required.`);
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
    throw new ReevaluateDeferredSchedulingRunsValidationError("requestedAt must be an ISO-8601 timestamp.");
  }
  return new Date(parsed).toISOString();
}

export class ReevaluateDeferredSchedulingRunsValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReevaluateDeferredSchedulingRunsValidationError";
  }
}

export interface ReevaluateDeferredSchedulingRunsRequest {
  readonly workspaceId: string;
  readonly actorUserIdentityId: string;
  readonly queueId?: string;
  readonly runIds?: ReadonlyArray<string>;
  readonly requestedAt?: string;
  readonly reason?: string;
  readonly limit?: number;
  readonly correlationId?: string;
}

export interface ReevaluateDeferredSchedulingRunsResult {
  readonly requestedAt: string;
  readonly reEvaluatedCount: number;
  readonly runIds: ReadonlyArray<string>;
  readonly mutationId: string;
}

export class ReevaluateDeferredSchedulingRunsUseCase {
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

  public async execute(input: ReevaluateDeferredSchedulingRunsRequest): Promise<ReevaluateDeferredSchedulingRunsResult> {
    if (!this.dependencies.queueRepository.reconsiderDeferredRunsForScheduling) {
      throw new ReevaluateDeferredSchedulingRunsValidationError("Deferred-run re-evaluation is not supported by queue persistence.");
    }
    const workspaceId = normalizeRequired(input.workspaceId, "workspaceId");
    const actorUserIdentityId = normalizeRequired(input.actorUserIdentityId, "actorUserIdentityId");
    const requestedAt = normalizeIso(input.requestedAt, this.now().toISOString());
    const queueId = normalizeOptional(input.queueId);
    const runIds = Object.freeze((input.runIds ?? [])
      .map((runId) => normalizeOptional(runId))
      .filter((runId): runId is string => Boolean(runId)));
    const reason = normalizeOptional(input.reason);
    const correlationId = normalizeOptional(input.correlationId);
    const limit = Math.max(1, Math.min(200, input.limit ?? 100));

    const reconsidered = await this.dependencies.queueRepository.reconsiderDeferredRunsForScheduling({
      asOf: requestedAt,
      workspaceId,
      queueId,
      runIds: runIds.length > 0 ? runIds : undefined,
      limit,
    });

    const mutationId = this.idGenerator.nextId("run:scheduling-admin-reevaluate-deferred");
    for (const entry of reconsidered) {
      await this.appendAuditEvent({
        entryRunId: entry.runId,
        queueId: entry.queueId,
        workspaceId,
        actorUserIdentityId,
        requestedAt,
        mutationId,
        reason,
        correlationId,
      });
    }

    return Object.freeze({
      requestedAt,
      reEvaluatedCount: reconsidered.length,
      runIds: Object.freeze(reconsidered.map((entry) => entry.runId)),
      mutationId,
    });
  }

  private async appendAuditEvent(input: {
    readonly entryRunId: string;
    readonly queueId: string;
    readonly workspaceId: string;
    readonly actorUserIdentityId: string;
    readonly requestedAt: string;
    readonly mutationId: string;
    readonly reason?: string;
    readonly correlationId?: string;
  }): Promise<void> {
    const event: PlatformAuditEventRecord = Object.freeze({
      eventId: this.idGenerator.nextId("audit"),
      eventKind: PlatformAuditEventKinds.runs,
      action: "run.scheduling.admin.deferred.re-evaluated",
      actorId: input.actorUserIdentityId,
      workspaceId: input.workspaceId,
      userIdentityId: input.actorUserIdentityId,
      targetRef: `run:${input.entryRunId}`,
      outcome: "succeeded",
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
      details: Object.freeze({
        mutationId: input.mutationId,
        queueId: input.queueId,
        reason: input.reason,
      }),
    });

    await this.dependencies.orchestrationIntentRepository.appendOrchestrationIntent(event, {
      operationKey: `run:scheduling-admin:re-evaluate-deferred:${input.entryRunId}:${event.eventId}`,
      actorId: input.actorUserIdentityId,
      occurredAt: input.requestedAt,
      correlationId: input.correlationId,
    });

    if (!this.dependencies.authoritativeAuditRecorder) {
      return;
    }

    try {
      await this.dependencies.authoritativeAuditRecorder.recordRunsEvent({
        operationKey: `run:scheduling-admin:re-evaluate-deferred:${input.entryRunId}:${input.mutationId}`,
        eventType: "run-scheduling-admin-deferred-re-evaluated",
        action: "run.scheduling.admin.deferred.re-evaluated",
        outcome: AuditEventOutcomes.succeeded,
        occurredAt: input.requestedAt,
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
          resourceId: input.entryRunId,
          resourceRef: input.entryRunId.startsWith("run:") ? input.entryRunId : `run:${input.entryRunId}`,
          sensitivityClass: "sensitive",
          workspaceId: input.workspaceId,
        }),
        correlationId: input.correlationId,
        payload: Object.freeze({
          userSafeDetails: Object.freeze({
            mutationId: input.mutationId,
            queueId: input.queueId,
            reasonCode: "deferred-run-re-evaluated",
          }),
          adminOnlyDetails: Object.freeze({
            reason: input.reason,
          }),
        }),
      });
    } catch {
      // Authoritative audit recording is best-effort and must not fail scheduling-admin behavior.
    }
  }
}

