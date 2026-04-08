import { describe, expect, it } from "bun:test";
import {
  createImageRunRecord,
  ImageRunStatuses,
  transitionImageRunRecord,
  type ImageRunRecord,
} from "@domain/runs/ImageRunDomain";
import { AssetId } from "@domain/assets/AssetId";
import {
  ImageManipulationExecutionCancellationStatuses,
  ImageManipulationExecutionProgressEventKinds,
  ImageManipulationExecutionStates,
  type IImageRunCancellationOrchestrationPort,
  type IImageRunExecutionHandoffPort,
  type IImageRunExecutionStateRepository,
  type IImageRunExecutionUpdatePort,
  type IImageRunOutputHandoffNotificationPort,
  type IImageRunQueueOrchestrationPort,
  type IImageRunReadinessResolver,
  type IImageRunRepository,
  type ImageRunExecutionHandoffRequest,
  type ImageRunExecutionHandoffReceipt,
  type ImageRunExecutionOutputRecord,
  type ImageRunExecutionProgressLogRecord,
  type ImageRunExecutionStateRecord,
  type ImageRunExecutionUpdateEnvelope,
  type ImageRunMutationContext,
  type ImageRunMutationResult,
  type ImageRunOrchestrationPorts,
  type ImageRunQueueEntry,
} from "../ports";

function createDraftRunRecord(runId: string): ImageRunRecord {
  return createImageRunRecord({
    identity: {
      runId,
      workspaceId: "workspace-alpha",
      ownerUserId: "user-alpha",
    },
    composition: {
      systemId: "system-image-1",
      workflowId: "workflow-image-1",
    },
    inputAssetBindings: [{
      bindingId: "source-image",
      role: "source",
      assetId: new AssetId("asset:image:source-1"),
    }],
    parameterSnapshot: {
      prompt: "cinematic portrait",
    },
    status: ImageRunStatuses.requested,
    statusTimestamps: {
      requestedAt: "2026-04-08T18:00:00.000Z",
    },
    createdAt: "2026-04-08T18:00:00.000Z",
    createdBy: "user-alpha",
  });
}

class InMemoryImageRunOrchestrationAdapter
  implements
    IImageRunRepository,
    IImageRunExecutionStateRepository,
    IImageRunReadinessResolver,
    IImageRunQueueOrchestrationPort,
    IImageRunExecutionHandoffPort,
    IImageRunExecutionUpdatePort,
    IImageRunCancellationOrchestrationPort,
    IImageRunOutputHandoffNotificationPort {
  private readonly runs = new Map<string, ImageRunRecord>();

  private readonly queueEntries = new Map<string, ImageRunQueueEntry>();

  private readonly executionStates = new Map<string, ImageRunExecutionStateRecord>();

  private readonly executionUpdates = new Map<string, ReadonlyArray<ImageRunExecutionUpdateEnvelope>>();

  private readonly executionProgressLogs = new Map<string, ReadonlyArray<ImageRunExecutionProgressLogRecord>>();

  private readonly executionOutputSnapshots = new Map<string, ImageRunExecutionOutputRecord>();

  private notifiedOutputs = 0;

  public getNotifiedOutputsCount(): number {
    return this.notifiedOutputs;
  }

  public async findImageRunById(runId: string): Promise<ImageRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listImageRuns(query: {
    readonly workspaceId: string;
    readonly statuses?: ReadonlyArray<ImageRunRecord["status"]>;
  }): Promise<ReadonlyArray<ImageRunRecord>> {
    return [...this.runs.values()]
      .filter((entry) => entry.identity.workspaceId === query.workspaceId)
      .filter((entry) => !query.statuses || query.statuses.includes(entry.status));
  }

  public async createImageRun(
    run: ImageRunRecord,
    _mutation: ImageRunMutationContext,
  ): Promise<ImageRunMutationResult> {
    this.runs.set(run.identity.runId, run);
    return {
      changed: true,
      wasReplay: false,
      run,
    };
  }

  public async saveImageRun(
    run: ImageRunRecord,
    _mutation: ImageRunMutationContext,
  ): Promise<ImageRunMutationResult> {
    const previous = this.runs.get(run.identity.runId);
    this.runs.set(run.identity.runId, run);
    return {
      changed: JSON.stringify(previous) !== JSON.stringify(run),
      wasReplay: false,
      run,
    };
  }

  public async findExecutionStateByRunId(runId: string): Promise<ImageRunExecutionStateRecord | undefined> {
    return this.executionStates.get(runId);
  }

  public async saveExecutionState(
    state: ImageRunExecutionStateRecord,
    _mutation: ImageRunMutationContext,
  ): Promise<ImageRunExecutionStateRecord> {
    this.executionStates.set(state.runId, state);
    return state;
  }

  public async appendExecutionProgressEvents(
    events: ReadonlyArray<ImageRunExecutionProgressLogRecord>,
    _mutation: ImageRunMutationContext,
  ): Promise<ReadonlyArray<ImageRunExecutionProgressLogRecord>> {
    for (const event of events) {
      const current = this.executionProgressLogs.get(event.runId) ?? [];
      this.executionProgressLogs.set(event.runId, Object.freeze([...current, event]));
    }
    return events;
  }

  public async saveExecutionOutputSnapshot(
    output: ImageRunExecutionOutputRecord,
    _mutation: ImageRunMutationContext,
  ): Promise<ImageRunExecutionOutputRecord> {
    this.executionOutputSnapshots.set(output.runId, output);
    return output;
  }

  public async listExecutionUpdates(input: {
    readonly runId: string;
    readonly afterProgressSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageRunExecutionUpdateEnvelope>> {
    const updates = this.executionUpdates.get(input.runId) ?? [];
    const filtered = typeof input.afterProgressSequence === "number"
      ? updates.filter((entry) => (entry.progressEvent?.sequence ?? 0) > input.afterProgressSequence)
      : updates;
    return typeof input.limit === "number" ? filtered.slice(0, input.limit) : filtered;
  }

  public async resolveRunExecutionReadiness(): Promise<{
    readonly backendFamily: string;
    readonly checkedAt: string;
    readonly readiness: "ready" | "degraded" | "unavailable";
    readonly readyForExecution: boolean;
    readonly capabilities: {
      readonly backendFamily: string;
      readonly supportsProgressPolling: boolean;
      readonly supportsProgressStreaming: boolean;
      readonly supportsCancellation: boolean;
      readonly supportsOutputDiscovery: boolean;
      readonly supportedOperationKinds: ReadonlyArray<string>;
      readonly supportedTranslationContractVersions: ReadonlyArray<string>;
    };
    readonly nodeAvailability: {
      readonly state: "available" | "constrained" | "unavailable" | "unknown";
      readonly checkedAt: string;
      readonly candidateNodeCount: number;
      readonly eligibleNodeCount: number;
      readonly unavailableNodeCount: number;
      readonly incompatibleNodeCount: number;
      readonly topBlockingReasonCodes: ReadonlyArray<string>;
      readonly topTransientAvailabilityReasonCodes: ReadonlyArray<string>;
      readonly reasonCode?: string;
    };
    readonly issues: ReadonlyArray<{
      readonly code: string;
      readonly severity: "error" | "warning";
      readonly message: string;
    }>;
  }> {
    return {
      backendFamily: "adapter.comfyui.image-manipulation",
      checkedAt: "2026-04-08T18:00:02.000Z",
      readiness: "ready",
      readyForExecution: true,
      capabilities: {
        backendFamily: "adapter.comfyui.image-manipulation",
        supportsProgressPolling: true,
        supportsProgressStreaming: true,
        supportsCancellation: true,
        supportsOutputDiscovery: true,
        supportedOperationKinds: ["image-to-image"],
        supportedTranslationContractVersions: ["1.0.0"],
      },
      nodeAvailability: {
        state: "available",
        checkedAt: "2026-04-08T18:00:02.000Z",
        candidateNodeCount: 1,
        eligibleNodeCount: 1,
        unavailableNodeCount: 0,
        incompatibleNodeCount: 0,
        topBlockingReasonCodes: [],
        topTransientAvailabilityReasonCodes: [],
      },
      issues: [],
    };
  }

  public async enqueueRun(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly queueId: string;
    readonly enqueuedAt: string;
    readonly eligibleAt?: string;
    readonly schedulingPriority?: number;
  }): Promise<ImageRunQueueEntry> {
    const entry: ImageRunQueueEntry = Object.freeze({
      runId: input.runId,
      workspaceId: input.workspaceId,
      queueId: input.queueId,
      enqueuedAt: input.enqueuedAt,
      eligibleAt: input.eligibleAt ?? input.enqueuedAt,
      schedulingPriority: input.schedulingPriority,
      reservationToken: `claim:${input.runId}`,
      reservedBy: "scheduler-1",
      reservedAt: input.enqueuedAt,
      reservationExpiresAt: "2026-04-08T18:01:00.000Z",
    });
    this.queueEntries.set(input.runId, entry);
    return entry;
  }

  public async handoffExecution(request: ImageRunExecutionHandoffRequest): Promise<ImageRunExecutionHandoffReceipt> {
    const dispatch = {
      requestId: request.dispatchRequest.requestId,
      runId: request.runId,
      executionJobId: `job:${request.runId}`,
      acceptedAt: "2026-04-08T18:00:05.000Z",
      initialState: ImageManipulationExecutionStates.queued,
      backendFamily: "adapter.comfyui.image-manipulation",
      backendExecutionId: `comfy:${request.runId}`,
    } as const;

    this.executionUpdates.set(request.runId, Object.freeze([
      Object.freeze({
        kind: "progress-event" as const,
        runId: request.runId,
        workspaceId: request.workspaceId,
        executionJobId: dispatch.executionJobId,
        occurredAt: "2026-04-08T18:00:10.000Z",
        progressEvent: Object.freeze({
          executionJobId: dispatch.executionJobId,
          runId: request.runId,
          workspaceId: request.workspaceId,
          sequence: 1,
          occurredAt: "2026-04-08T18:00:10.000Z",
          kind: ImageManipulationExecutionProgressEventKinds.heartbeat,
          state: ImageManipulationExecutionStates.running,
          progressPercent: 45,
          stage: "rendering",
          message: "render in progress",
        }),
      }),
    ]));

    return {
      runId: request.runId,
      workspaceId: request.workspaceId,
      queueId: request.queuedEntry.queueId,
      dispatch,
    };
  }

  public async pollExecutionUpdates(input: {
    readonly runId: string;
    readonly workspaceId: string;
    readonly executionJobId: string;
    readonly afterSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageRunExecutionUpdateEnvelope>> {
    const updates = await this.listExecutionUpdates({
      runId: input.runId,
      workspaceId: input.workspaceId,
      afterProgressSequence: input.afterSequence,
      limit: input.limit,
    });
    return updates.filter((entry) => entry.executionJobId === input.executionJobId);
  }

  public async subscribeToExecutionUpdates(
    input: {
      readonly runId: string;
      readonly workspaceId: string;
      readonly executionJobId: string;
    },
    sink: (update: ImageRunExecutionUpdateEnvelope) => void,
  ): Promise<() => void> {
    const updates = await this.pollExecutionUpdates({
      runId: input.runId,
      workspaceId: input.workspaceId,
      executionJobId: input.executionJobId,
    });
    for (const update of updates) {
      sink(update);
    }
    return () => undefined;
  }

  public async requestRunCancellation(): Promise<{
    readonly status: "accepted" | "already-terminal" | "not-supported" | "rejected" | "not-found" | "failed";
    readonly acknowledgedAt?: string;
  }> {
    return {
      status: ImageManipulationExecutionCancellationStatuses.accepted,
      acknowledgedAt: "2026-04-08T18:02:00.000Z",
    };
  }

  public async notifyRunOutputsAvailable(): Promise<void> {
    this.notifiedOutputs += 1;
  }
}

describe("image run orchestration ports", () => {
  it("supports repository + execution state persistence boundaries for authoritative run lifecycle updates", async () => {
    const adapter = new InMemoryImageRunOrchestrationAdapter();
    const run = createDraftRunRecord("run-1");

    const created = await adapter.createImageRun(run, {
      operationKey: "create-run-1",
      actorUserId: "user-alpha",
    });
    expect(created.run.status).toBe(ImageRunStatuses.requested);

    const queuedRun = transitionImageRunRecord(created.run, {
      toStatus: ImageRunStatuses.validating,
      occurredAt: "2026-04-08T18:00:01.000Z",
      changedBy: "orchestrator",
    });

    const saved = await adapter.saveImageRun(queuedRun, {
      operationKey: "save-run-1",
      actorUserId: "orchestrator",
    });
    expect(saved.run.status).toBe(ImageRunStatuses.validating);

    const state = await adapter.saveExecutionState({
      runId: "run-1",
      workspaceId: "workspace-alpha",
      executionJobId: "job:run-1",
      backendFamily: "adapter.comfyui.image-manipulation",
      backendExecutionId: "comfy:run-1",
      latestState: {
        executionJobId: "job:run-1",
        runId: "run-1",
        workspaceId: "workspace-alpha",
        state: ImageManipulationExecutionStates.running,
        backendFamily: "adapter.comfyui.image-manipulation",
        updatedAt: "2026-04-08T18:00:20.000Z",
        startedAt: "2026-04-08T18:00:05.000Z",
        progressPercent: 45,
      },
      lastProgressSequence: 1,
      updatedAt: "2026-04-08T18:00:20.000Z",
    }, {
      operationKey: "state-1",
      actorUserId: "orchestrator",
    });
    expect(state.latestState.state).toBe(ImageManipulationExecutionStates.running);
  });

  it("allows orchestration flow to depend only on queue/dispatch/update/cancellation/output ports", async () => {
    const adapter = new InMemoryImageRunOrchestrationAdapter();
    const ports: ImageRunOrchestrationPorts = {
      runs: adapter,
      executionState: adapter,
      readiness: adapter,
      queue: adapter,
      executionHandoff: adapter,
      executionUpdates: adapter,
      cancellation: adapter,
      outputHandoff: adapter,
    };

    const readiness = await ports.readiness.resolveRunExecutionReadiness({
      workspaceId: "workspace-alpha",
      systemId: "system-image-1",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });
    expect(readiness.readyForExecution).toBeTrue();

    const queueEntry = await ports.queue.enqueueRun({
      runId: "run-2",
      workspaceId: "workspace-alpha",
      queueId: "queue:image-default",
      enqueuedAt: "2026-04-08T18:00:00.000Z",
    });
    expect(queueEntry.queueId).toBe("queue:image-default");

    const handoff = await ports.executionHandoff.handoffExecution({
      runId: "run-2",
      workspaceId: "workspace-alpha",
      queuedEntry: queueEntry,
      dispatchRequest: {
        requestId: "dispatch-2",
        runId: "run-2",
        workspaceId: "workspace-alpha",
        workflow: {
          workflowId: "workflow-image-1",
          workflowVersionTag: "1.0.0",
          workflowRevision: 1,
          operationKind: "image-to-image",
          backendTranslation: {
            translatorId: "translator:image-to-image",
            contractVersion: "1.0.0",
            templateId: "template:image-to-image",
            inputBindings: [{
              inputId: "source-image",
              backendField: "inputs.source",
            }],
            parameterBindings: [],
            outputBindings: [{
              outputId: "generated-image",
              backendField: "outputs.images[0]",
            }],
          },
        },
        system: {
          systemId: "system-image-1",
        },
        inputAssets: [{
          inputId: "source-image",
          logicalAssetReference: "asset://image/source-1",
        }],
        outputTargets: [{
          outputId: "generated-image",
          logicalTargetReference: "dataset-instance://outputs",
          required: true,
        }],
        parameters: {
          prompt: "cinematic portrait",
        },
        requestedAt: "2026-04-08T18:00:00.000Z",
      },
    });
    expect(handoff.dispatch.executionJobId).toBe("job:run-2");

    const updates = await ports.executionUpdates.pollExecutionUpdates({
      runId: "run-2",
      workspaceId: "workspace-alpha",
      executionJobId: handoff.dispatch.executionJobId,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.progressEvent?.kind).toBe(ImageManipulationExecutionProgressEventKinds.heartbeat);

    const cancellation = await ports.cancellation.requestRunCancellation({
      runId: "run-2",
      workspaceId: "workspace-alpha",
      executionJobId: handoff.dispatch.executionJobId,
      requestedAt: "2026-04-08T18:02:00.000Z",
      reason: "user-requested",
    });
    expect(cancellation.status).toBe(ImageManipulationExecutionCancellationStatuses.accepted);

    await ports.outputHandoff.notifyRunOutputsAvailable({
      runId: "run-2",
      workspaceId: "workspace-alpha",
      executionJobId: handoff.dispatch.executionJobId,
      outputSnapshot: {
        executionJobId: handoff.dispatch.executionJobId,
        runId: "run-2",
        workspaceId: "workspace-alpha",
        state: ImageManipulationExecutionStates.completed,
        discoveredAt: "2026-04-08T18:04:00.000Z",
        outputs: [{
          outputId: "generated-image",
          kind: "asset-reference",
          assetId: "asset:image:generated-1",
        }],
      },
      notifiedAt: "2026-04-08T18:04:01.000Z",
    });

    expect(adapter.getNotifiedOutputsCount()).toBe(1);
  });
});
