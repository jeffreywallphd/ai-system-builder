import type { IAuthoritativeRunPersistenceRepository, IRunOrchestrationQueuePersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunLifecycleStates, type RunLifecycleState } from "@domain/runs/RunDomain";
import type { RunQueueStatusReadResponse } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  toRunSummary,
  type RunQueueStatusItem,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { mapPlatformRunRecordToCanonicalRun } from "./RunCreationPersistenceMapper";
import { buildRunSchedulingVisibilityProjection } from "./RunSchedulingVisibilityProjection";

export interface ListAuthoritativeRunQueueStatusRequest {
  readonly workspaceId: string;
  readonly statuses?: ReadonlyArray<RunLifecycleState>;
  readonly limit?: number;
  readonly offset?: number;
  readonly asOf?: string;
}

export class ListAuthoritativeRunQueueStatusUseCase {
  public constructor(
    private readonly dependencies: {
      readonly runRepository: IAuthoritativeRunPersistenceRepository;
      readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
      readonly now?: () => Date;
    },
  ) {}

  public async execute(input: ListAuthoritativeRunQueueStatusRequest): Promise<RunQueueStatusReadResponse> {
    const workspaceId = input.workspaceId.trim();
    const asOf = (input.asOf?.trim() || this.dependencies.now?.().toISOString() || new Date().toISOString());
    if (!workspaceId || !this.dependencies.queueRepository.listQueueEntries) {
      return Object.freeze({
        items: Object.freeze([]),
        totalCount: 0,
        asOf,
      });
    }

    const queueEntries = await this.dependencies.queueRepository.listQueueEntries({
      workspaceId,
      lifecycleStates: normalizeStates(input.statuses),
      includeDequeued: true,
    });

    const positionedRunIds = resolveActiveQueuePositions(queueEntries);
    const queueItems: RunQueueStatusItem[] = [];
    for (const queueEntry of queueEntries) {
      const runRecord = await this.dependencies.runRepository.findRunById(queueEntry.runId);
      if (!runRecord || runRecord.workspaceId !== workspaceId) {
        continue;
      }

      const run = mapPlatformRunRecordToCanonicalRun(runRecord);
      const summary = toRunSummary(run);
      const scheduling = buildRunSchedulingVisibilityProjection({
        runRecord,
        queueEntry,
      });
      queueItems.push(Object.freeze({
        runId: summary.runId,
        workflowId: summary.workflowId,
        workspaceId,
        state: summary.state,
        queue: Object.freeze({
          queueId: queueEntry.queueId,
          enteredAt: queueEntry.enteredAt,
          position: positionedRunIds.get(queueEntry.runId) ?? null,
          positionAsOf: asOf,
          dequeuedAt: queueEntry.dequeuedAt,
        }),
        assignmentStatus: summary.assignmentStatus,
        executionOutcome: summary.executionOutcome,
        updatedAt: summary.updatedAt,
        actionAvailability: summary.actionAvailability,
        failureSummary: summary.failureSummary,
        scheduling,
      }));
    }

    const offset = Math.max(0, input.offset ?? 0);
    const limit = typeof input.limit === "number" ? Math.max(1, input.limit) : undefined;
    const paged = typeof limit === "number"
      ? queueItems.slice(offset, offset + limit)
      : queueItems.slice(offset);

    return Object.freeze({
      items: Object.freeze(paged),
      totalCount: queueItems.length,
      asOf,
    });
  }
}

function normalizeStates(states: ReadonlyArray<RunLifecycleState> | undefined): ReadonlyArray<RunLifecycleState> | undefined {
  const normalized = states
    ?.map((state) => state.trim())
    .filter((state): state is RunLifecycleState => Object.values(RunLifecycleStates).includes(
      state as typeof RunLifecycleStates[keyof typeof RunLifecycleStates],
    ));

  if (!normalized || normalized.length === 0) {
    return undefined;
  }

  return Object.freeze(normalized);
}

function resolveActiveQueuePositions(
  queueEntries: ReadonlyArray<{
    readonly runId: string;
    readonly dequeuedAt?: string;
    readonly lifecycleState: RunLifecycleState;
    readonly eligibleAt: string;
    readonly orderKey: string;
    readonly enteredAt: string;
  }>,
): ReadonlyMap<string, number> {
  const active = queueEntries
    .filter((entry) => !entry.dequeuedAt)
    .filter((entry) => entry.lifecycleState !== RunLifecycleStates.completed)
    .filter((entry) => entry.lifecycleState !== RunLifecycleStates.failed)
    .filter((entry) => entry.lifecycleState !== RunLifecycleStates.cancelled)
    .sort((left, right) => left.eligibleAt.localeCompare(right.eligibleAt)
      || left.orderKey.localeCompare(right.orderKey)
      || left.enteredAt.localeCompare(right.enteredAt)
      || left.runId.localeCompare(right.runId));

  const positions = new Map<string, number>();
  for (let index = 0; index < active.length; index += 1) {
    positions.set(active[index]!.runId, index + 1);
  }
  return positions;
}
