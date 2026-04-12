import { randomUUID } from "node:crypto";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "@application/common/ports/PlatformTransactionPorts";
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  AuthoritativeRunNodeClaimConflict,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunLifecycleStates,
  transitionCanonicalRunRecord,
} from "@domain/runs/RunDomain";
import { toRunDetail, type RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  mapPlatformRunRecordToCanonicalRun,
  updatePlatformRunRecordCanonicalState,
  type RunAuthoritativeMetadata,
} from "./RunCreationPersistenceMapper";

export interface ClaimRunForNodeDispatchPreparationRequest {
  readonly runId: string;
  readonly nodeId: string;
  readonly reservationOwner: string;
  readonly claimToken: string;
  readonly preparedAt?: string;
}

export interface ClaimRunForNodeDispatchPreparationResult {
  readonly run: RunDetail;
  readonly queue: {
    readonly queueId: string;
    readonly claimToken: string;
    readonly reservationOwner: string;
    readonly assignmentNodeId: string;
    readonly assignmentClaimedAt: string;
    readonly dispatchPreparedAt: string;
  };
  readonly dispatchPreparation: {
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  };
}

interface ClaimRunForNodeDispatchPreparationUseCaseDependencies {
  readonly runRepository: IAuthoritativeRunPersistenceRepository;
  readonly queueRepository: IRunOrchestrationQueuePersistenceRepository;
  readonly transactionManager?: IPlatformTransactionManager;
  readonly now?: () => Date;
  readonly idGenerator?: {
    nextId(prefix: string): string;
  };
}

export class RunNodeDispatchClaimConflictError extends Error {
  public readonly conflict: AuthoritativeRunNodeClaimConflict;

  public constructor(conflict: AuthoritativeRunNodeClaimConflict) {
    super(conflict.message);
    this.name = "RunNodeDispatchClaimConflictError";
    this.conflict = conflict;
  }
}

function normalizeRequired(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export class ClaimRunForNodeDispatchPreparationUseCase {
  private readonly now: () => Date;
  private readonly idGenerator: {
    nextId(prefix: string): string;
  };

  public constructor(private readonly dependencies: ClaimRunForNodeDispatchPreparationUseCaseDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.idGenerator = dependencies.idGenerator ?? {
      nextId: (prefix) => `${prefix}:${randomUUID()}`,
    };
  }

  public async execute(
    request: ClaimRunForNodeDispatchPreparationRequest,
  ): Promise<ClaimRunForNodeDispatchPreparationResult> {
    const runId = normalizeRequired(request.runId, "runId");
    const nodeId = normalizeRequired(request.nodeId, "nodeId");
    const reservationOwner = normalizeRequired(request.reservationOwner, "reservationOwner");
    const claimToken = normalizeRequired(request.claimToken, "claimToken");
    const preparedAt = request.preparedAt?.trim() || this.now().toISOString();
    const dispatchAttemptId = this.idGenerator.nextId("dispatch-attempt");

    let result: ClaimRunForNodeDispatchPreparationResult | undefined;
    await runInTransactionBoundary(this.dependencies.transactionManager, async () => {
      const persistedRun = await this.dependencies.runRepository.findRunById(runId);
      if (!persistedRun) {
        throw new Error(`Run '${runId}' was not found.`);
      }

      const canonicalRun = mapPlatformRunRecordToCanonicalRun(persistedRun);
      if (
        canonicalRun.state === RunLifecycleStates.assigned
        || canonicalRun.state === RunLifecycleStates.dispatching
        || canonicalRun.state === RunLifecycleStates.running
      ) {
        throw new RunNodeDispatchClaimConflictError(Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId,
          nodeId,
          message: `Run '${runId}' is already assigned and cannot be claimed again.`,
        }));
      }
      if (canonicalRun.state !== RunLifecycleStates.queued && canonicalRun.state !== RunLifecycleStates.assignmentPending) {
        throw new Error(`Run '${runId}' must be queued or assignment-pending before node claim.`);
      }
      if (!canonicalRun.queue) {
        throw new Error(`Run '${runId}' does not include queue metadata required for node dispatch claim.`);
      }

      const transitionedRun = transitionCanonicalRunRecord(canonicalRun, {
        toState: RunLifecycleStates.assigned,
        occurredAt: preparedAt,
        queue: Object.freeze({
          ...canonicalRun.queue,
          dequeuedAt: preparedAt,
          positionAsOf: preparedAt,
        }),
        assignment: Object.freeze({
          status: "assigned",
          assignedNodeId: nodeId,
          assignedAt: preparedAt,
        }),
      });

      const runMetadata = resolveRunMetadata(persistedRun.metadata);
      const dispatchMetadata = Object.freeze({
        runId,
        nodeId,
        queueId: canonicalRun.queue.queueId,
        workspaceId: canonicalRun.identity.workspaceId,
        submittedAt: canonicalRun.submission.submittedAt,
        preparedAt,
        runtimeTarget: runMetadata?.submissionSnapshot.runtimeTarget ?? undefined,
        storageReferences: runMetadata?.submissionSnapshot.storageReferences ?? [],
        resourceReferences: runMetadata?.submissionSnapshot.resourceReferences ?? [],
        policyPrerequisites: runMetadata?.submissionSnapshot.policyPrerequisites ?? [],
      }) satisfies Readonly<Record<string, unknown>>;

      const queueClaim = await this.dependencies.queueRepository.claimQueuedRunForNodeDispatch({
        runId,
        nodeId,
        reservationOwner,
        claimToken,
        dispatchAttemptId,
        preparedAt,
        dispatchMetadata,
      });
      if (queueClaim.outcome === "conflict") {
        throw new RunNodeDispatchClaimConflictError(queueClaim.conflict);
      }

      const persistedNextRun = updatePlatformRunRecordCanonicalState(persistedRun, transitionedRun);

      const persistedRunRecord = await this.dependencies.runRepository.saveRun({
        ...persistedNextRun,
        runId: persistedRun.runId,
        revision: persistedRun.revision,
      }, {
        operationKey: `run:node-dispatch-claim:${runId}:${dispatchAttemptId}`,
        actorId: reservationOwner,
        occurredAt: preparedAt,
        correlationId: canonicalRun.submission.correlationId,
        expectedRevision: persistedRun.revision,
      });

      result = Object.freeze({
        run: toRunDetail(mapPlatformRunRecordToCanonicalRun(persistedRunRecord.record)),
        queue: Object.freeze({
          queueId: queueClaim.queueEntry.queueId,
          claimToken,
          reservationOwner,
          assignmentNodeId: queueClaim.queueEntry.assignmentNodeId ?? nodeId,
          assignmentClaimedAt: queueClaim.queueEntry.assignmentClaimedAt ?? preparedAt,
          dispatchPreparedAt: queueClaim.queueEntry.dispatchPreparedAt ?? preparedAt,
        }),
        dispatchPreparation: Object.freeze({
          dispatchAttemptId: queueClaim.dispatchAttempt.attemptId,
          preparedAt: queueClaim.dispatchAttempt.preparedAt,
          dispatchMetadata: queueClaim.dispatchAttempt.dispatchMetadata,
        }),
      });
    });

    if (!result) {
      throw new Error(`Dispatch preparation failed for run '${runId}'.`);
    }
    return result;
  }
}

function resolveRunMetadata(metadata: unknown): RunAuthoritativeMetadata | undefined {
  if (!isObject(metadata)) {
    return undefined;
  }
  if (!("submissionSnapshot" in metadata)) {
    return undefined;
  }
  return metadata as RunAuthoritativeMetadata;
}
