import { describe, expect, it } from "bun:test";
import { PlatformRunStatuses, type PlatformPersistenceMutationContext, type PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunDispatchAttemptResult,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IRunCollectedResultPersistencePort,
  IRunOrchestrationQueuePersistenceRepository,
  RunCollectedResultPersistenceRequest,
  RunCollectedResultPersistenceResult,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { AuditLedgerAppendResult } from "@application/audit/AuditApplicationContracts";
import type { AuthoritativeAuditRecordEventInput } from "@application/audit/ports/AuthoritativeAuditRecordingPorts";
import type { CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import { FinalizeRunExecutionOutcomeUseCase } from "../use-cases/FinalizeRunExecutionOutcomeUseCase";
import {
  RunAssignmentStatuses,
  RunExecutionOutcomeKinds,
  RunLifecycleStates,
  RunSubmissionSources,
  type CanonicalRunRecord,
  type RunLifecycleState,
  createCanonicalRunRecord,
} from "@domain/runs/RunDomain";

class CapturingQueueRepository implements IRunOrchestrationQueuePersistenceRepository {
  public readonly finalized: Array<{ runId: string; lifecycleState: RunLifecycleState }> = [];

  public async getQueueEntryByRunId(_runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return undefined;
  }

  public async enqueueRunForAssignment(
    _record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    throw new Error("Not implemented.");
  }

  public async listAssignmentReadyRuns(_query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async claimAssignmentReadyRuns(_input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    return Object.freeze([]);
  }

  public async releaseRunClaim(_input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    return false;
  }

  public async claimQueuedRunForNodeDispatch(_input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    throw new Error("Not implemented.");
  }

  public async recordDispatchAttemptResult(_input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    return false;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    this.finalized.push({ runId: input.runId, lifecycleState: input.lifecycleState });
    return true;
  }

  public async listDispatchAttemptsByRunId(_runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze([]);
  }
}

class CapturingResultCollectionPersistencePort implements IRunCollectedResultPersistencePort {
  public readonly calls: RunCollectedResultPersistenceRequest[] = [];
  public readonly result: RunCollectedResultPersistenceResult;
  public shouldThrow = false;

  public constructor(result?: RunCollectedResultPersistenceResult) {
    this.result = result ?? Object.freeze({
      status: "persisted",
      outputs: Object.freeze([Object.freeze({
        outputId: "generated:primary",
        kind: "asset",
        assetId: "asset:generated:primary",
      })]),
      outputAvailabilityHint: "available",
      terminalQualityHint: "standard",
      internalDiagnostics: Object.freeze({
        persistedCount: 1,
      }),
    });
  }

  public async persistCollectedResult(request: RunCollectedResultPersistenceRequest): Promise<RunCollectedResultPersistenceResult> {
    this.calls.push(request);
    if (this.shouldThrow) {
      throw new Error("simulated-storage-write-failure");
    }
    return this.result;
  }
}

class CapturingAuthoritativeAuditRecorder {
  public readonly events: AuthoritativeAuditRecordEventInput[] = [];

  public async recordRunsEvent(input: AuthoritativeAuditRecordEventInput): Promise<AuditLedgerAppendResult> {
    this.events.push(input);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      sequence: this.events.length,
      event: {} as CanonicalAuditEvent,
    });
  }
}

function createRunRecord(run: CanonicalRunRecord): PlatformRunRecord {
  return Object.freeze({
    runId: run.identity.runId,
    runKind: "workflow",
    status: PlatformRunStatuses.running,
    workspaceId: run.identity.workspaceId,
    userIdentityId: "user:owner",
    sourceAggregateRef: run.identity.workflowId,
    initiatedAt: run.submission.submittedAt,
    metadata: Object.freeze({}),
    revision: 1,
  });
}

function createRun(state: RunLifecycleState): CanonicalRunRecord {
  return createCanonicalRunRecord({
    identity: {
      runId: `run:${state}`,
      workflowId: "workflow:demo",
      workspaceId: "workspace-alpha",
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T12:00:00.000Z",
      submittedByActorId: "user:owner",
    },
    state,
    queue: {
      queueId: "queue:default",
      enteredAt: "2026-04-07T12:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T12:01:00.000Z",
      dequeuedAt: "2026-04-07T12:01:00.000Z",
    },
    assignment: {
      status: RunAssignmentStatuses.assigned,
      assignedNodeId: "node:trusted-1",
      assignedAt: "2026-04-07T12:01:00.000Z",
    },
    execution: {
      adapterKind: "local-worker",
      adapterRunId: "backend-run-1",
      startedAt: "2026-04-07T12:01:00.000Z",
      finishedAt: "2026-04-07T12:02:00.000Z",
      outcome: state === RunLifecycleStates.completed
        ? RunExecutionOutcomeKinds.succeeded
        : state === RunLifecycleStates.failed
          ? RunExecutionOutcomeKinds.failed
          : state === RunLifecycleStates.cancelled
            ? RunExecutionOutcomeKinds.cancelled
            : RunExecutionOutcomeKinds.none,
      errorCode: state === RunLifecycleStates.failed ? "execution-failed" : undefined,
      errorMessage: state === RunLifecycleStates.failed ? "Run failed." : undefined,
    },
    cancellation: state === RunLifecycleStates.cancelled
      ? {
        requestedAt: "2026-04-07T12:01:50.000Z",
        requestedByActorId: "user:owner",
        acknowledgedAt: "2026-04-07T12:02:00.000Z",
      }
      : undefined,
    retry: {
      attempt: 1,
      maxAttempts: 2,
    },
    updatedAt: "2026-04-07T12:02:00.000Z",
  });
}

describe("FinalizeRunExecutionOutcomeUseCase", () => {
  it("returns no-op results for non-terminal run states", async () => {
    const queueRepository = new CapturingQueueRepository();
    const useCase = new FinalizeRunExecutionOutcomeUseCase({ queueRepository });
    const runningRun = createRun(RunLifecycleStates.running);
    const result = await useCase.execute({
      run: runningRun,
      runRecord: createRunRecord(runningRun),
      occurredAt: "2026-04-07T12:03:00.000Z",
    });

    expect(result.finalization).toBeUndefined();
    expect(result.queueFinalized).toBeFalse();
    expect(queueRepository.finalized).toHaveLength(0);
  });

  it("finalizes cancelled runs and persists explicit output/quality hints", async () => {
    const queueRepository = new CapturingQueueRepository();
    const useCase = new FinalizeRunExecutionOutcomeUseCase({ queueRepository });
    const cancelledRun = createRun(RunLifecycleStates.cancelled);
    const result = await useCase.execute({
      run: cancelledRun,
      runRecord: createRunRecord(cancelledRun),
      occurredAt: "2026-04-07T12:03:00.000Z",
      lifecycleUpdate: Object.freeze({
        runId: cancelledRun.identity.runId,
        result: Object.freeze({
          summary: "Cancelled after collecting one output.",
          outputAvailabilityHint: "partial",
          terminalQualityHint: "degraded",
          outputs: Object.freeze([Object.freeze({
            outputId: "output-1",
            kind: "asset",
            assetId: "asset:partial",
          })]),
        }),
      }),
    });

    expect(result.queueFinalized).toBeTrue();
    expect(result.run.assignment.status).toBe("released");
    expect(result.run.assignment.releaseReason).toBe("execution-cancelled");
    expect(result.finalization?.outcome).toBe("cancelled");
    expect(result.finalization?.outputAvailability).toBe("partial");
    expect(result.finalization?.terminalQuality).toBe("degraded");
    expect(queueRepository.finalized[0]?.lifecycleState).toBe("cancelled");
  });

  it("hands off collected execution outputs to result persistence and uses returned asset outputs", async () => {
    const queueRepository = new CapturingQueueRepository();
    const persistencePort = new CapturingResultCollectionPersistencePort();
    const useCase = new FinalizeRunExecutionOutcomeUseCase({
      queueRepository,
      resultCollectionPersistencePort: persistencePort,
    });
    const completedRun = createRun(RunLifecycleStates.completed);
    const result = await useCase.execute({
      run: completedRun,
      runRecord: createRunRecord(completedRun),
      occurredAt: "2026-04-07T12:03:00.000Z",
      senderNodeId: "node:trusted-1",
      lifecycleUpdate: Object.freeze({
        runId: completedRun.identity.runId,
        result: Object.freeze({
          summary: "Collected outputs ready for persistence.",
        }),
      }),
      internalDiagnostics: Object.freeze({
        collectedExecutionResult: Object.freeze({
          schemaVersion: "1.0.0",
          collectionId: "collection:run:completed",
          discoveryId: "discovery:run:completed",
          executionJobId: "job:1",
          runId: completedRun.identity.runId,
          workspaceId: "workspace-alpha",
          collectedAt: "2026-04-07T12:02:00.000Z",
          status: "collected",
          discoveredOutputs: Object.freeze([Object.freeze({
            descriptorId: "descriptor:1",
            discoveredAt: "2026-04-07T12:01:59.000Z",
            outputRole: "primary",
            outputIndex: 0,
            media: Object.freeze({
              mediaKind: "image",
              mimeType: "image/png",
            }),
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "comfy-output:output:generated.png",
            }),
          })]),
          records: Object.freeze([Object.freeze({
            descriptorId: "descriptor:1",
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "comfy-output:output:generated.png",
            }),
            persistence: Object.freeze({
              status: "not-persisted",
              reason: "awaiting-managed-asset-persistence",
            }),
          })]),
          summary: Object.freeze({
            discoveredCount: 1,
            collectedCount: 1,
            persistedCount: 0,
            notPersistedCount: 1,
            failedCount: 0,
          }),
        }),
      }),
    });

    expect(persistencePort.calls).toHaveLength(1);
    expect(result.finalization?.outputs[0]?.assetId).toBe("asset:generated:primary");
    const telemetry = (result.runRecord.metadata as { executionTelemetry?: { finalizationInternal?: { resultPersistenceDiagnostics?: { persistedCount?: number } } } }).executionTelemetry;
    expect(telemetry?.finalizationInternal?.resultPersistenceDiagnostics?.persistedCount).toBe(1);
  });

  it("finalizes safely with degraded hints when result persistence throws", async () => {
    const queueRepository = new CapturingQueueRepository();
    const persistencePort = new CapturingResultCollectionPersistencePort();
    const authoritativeAuditRecorder = new CapturingAuthoritativeAuditRecorder();
    persistencePort.shouldThrow = true;
    const useCase = new FinalizeRunExecutionOutcomeUseCase({
      queueRepository,
      resultCollectionPersistencePort: persistencePort,
      authoritativeAuditRecorder,
    });
    const completedRun = createRun(RunLifecycleStates.completed);
    const result = await useCase.execute({
      run: completedRun,
      runRecord: createRunRecord(completedRun),
      occurredAt: "2026-04-07T12:03:00.000Z",
      internalDiagnostics: Object.freeze({
        collectedExecutionResult: Object.freeze({
          schemaVersion: "1.0.0",
          collectionId: "collection:run:completed",
          discoveryId: "discovery:run:completed",
          executionJobId: "job:1",
          runId: completedRun.identity.runId,
          workspaceId: "workspace-alpha",
          collectedAt: "2026-04-07T12:02:00.000Z",
          status: "collected",
          discoveredOutputs: Object.freeze([]),
          records: Object.freeze([]),
          summary: Object.freeze({
            discoveredCount: 0,
            collectedCount: 0,
            persistedCount: 0,
            notPersistedCount: 0,
            failedCount: 0,
          }),
        }),
      }),
    });

    expect(result.finalization?.outputAvailability).toBe("degraded");
    expect(result.finalization?.terminalQuality).toBe("degraded");
    const telemetry = (result.runRecord.metadata as { executionTelemetry?: { finalizationInternal?: { resultPersistenceDiagnostics?: { reasonCode?: string } } } }).executionTelemetry;
    expect(telemetry?.finalizationInternal?.resultPersistenceDiagnostics?.reasonCode).toBe("result-persistence-port-failed");
    expect(authoritativeAuditRecorder.events).toHaveLength(1);
    expect(authoritativeAuditRecorder.events[0]?.action).toBe("run.result.collection.failed");
    expect((authoritativeAuditRecorder.events[0]?.payload?.userSafeDetails as { issueCategory?: string } | undefined)?.issueCategory).toBe("result-collection-failure");
  });
});
