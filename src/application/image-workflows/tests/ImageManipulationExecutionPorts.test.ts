import { describe, expect, it } from "bun:test";
import type {
  IImageManipulationExecutionCancellationPort,
  IImageManipulationExecutionCapabilityPort,
  IImageManipulationExecutionDispatchPort,
  IImageManipulationExecutionOutputPort,
  IImageManipulationExecutionProgressPort,
  IImageManipulationExecutionStateQueryPort,
  ImageManipulationExecutionBackendStatus,
  ImageManipulationExecutionDispatchRequest,
  ImageManipulationExecutionDispatchResult,
  ImageManipulationExecutionOutputSnapshot,
  ImageManipulationExecutionPorts,
  ImageManipulationExecutionProgressEvent,
  ImageManipulationExecutionStateSnapshot,
} from "../ports";
import {
  ImageManipulationExecutionBackendHealthStates,
  ImageManipulationExecutionCancellationStatuses,
  ImageManipulationExecutionOutputReferenceKinds,
  ImageManipulationExecutionProgressEventKinds,
  ImageManipulationExecutionStates,
} from "../ports";

class InMemoryImageManipulationExecutionAdapter implements
  IImageManipulationExecutionDispatchPort,
  IImageManipulationExecutionStateQueryPort,
  IImageManipulationExecutionProgressPort,
  IImageManipulationExecutionCancellationPort,
  IImageManipulationExecutionOutputPort,
  IImageManipulationExecutionCapabilityPort {
  private readonly states = new Map<string, ImageManipulationExecutionStateSnapshot>();
  private readonly progress = new Map<string, ReadonlyArray<ImageManipulationExecutionProgressEvent>>();
  private readonly outputs = new Map<string, ImageManipulationExecutionOutputSnapshot>();

  public async dispatchExecution(request: ImageManipulationExecutionDispatchRequest): Promise<ImageManipulationExecutionDispatchResult> {
    const executionJobId = `job:${request.runId}`;
    const acceptedAt = "2026-04-08T18:00:00.000Z";
    const backendFamily = "adapter.comfyui.image-manipulation";

    const state: ImageManipulationExecutionStateSnapshot = Object.freeze({
      executionJobId,
      runId: request.runId,
      workspaceId: request.workspaceId,
      state: ImageManipulationExecutionStates.running,
      backendFamily,
      backendExecutionId: `comfy:${request.runId}`,
      startedAt: acceptedAt,
      updatedAt: acceptedAt,
      progressPercent: 65,
      stage: "rendering",
      message: "Rendering outputs",
    });
    this.states.set(executionJobId, state);

    const progressEvents: ReadonlyArray<ImageManipulationExecutionProgressEvent> = Object.freeze([
      Object.freeze({
        executionJobId,
        runId: request.runId,
        workspaceId: request.workspaceId,
        sequence: 1,
        occurredAt: "2026-04-08T18:00:00.000Z",
        kind: ImageManipulationExecutionProgressEventKinds.started,
        state: ImageManipulationExecutionStates.running,
        progressPercent: 5,
        stage: "startup",
      }),
      Object.freeze({
        executionJobId,
        runId: request.runId,
        workspaceId: request.workspaceId,
        sequence: 2,
        occurredAt: "2026-04-08T18:00:10.000Z",
        kind: ImageManipulationExecutionProgressEventKinds.heartbeat,
        state: ImageManipulationExecutionStates.running,
        progressPercent: 65,
        stage: "rendering",
      }),
    ]);
    this.progress.set(executionJobId, progressEvents);

    const outputSnapshot: ImageManipulationExecutionOutputSnapshot = Object.freeze({
      executionJobId,
      runId: request.runId,
      workspaceId: request.workspaceId,
      state: ImageManipulationExecutionStates.completed,
      discoveredAt: "2026-04-08T18:01:00.000Z",
      outputs: Object.freeze([
        Object.freeze({
          outputId: "generated-image",
          kind: ImageManipulationExecutionOutputReferenceKinds.assetReference,
          logicalReference: "asset://image/generated-1",
          assetId: "asset:image:generated-1",
          metadata: Object.freeze({ format: "png" }),
        }),
      ]),
    });
    this.outputs.set(executionJobId, outputSnapshot);

    return Object.freeze({
      requestId: request.requestId,
      runId: request.runId,
      executionJobId,
      acceptedAt,
      initialState: ImageManipulationExecutionStates.queued,
      backendFamily,
      backendExecutionId: `comfy:${request.runId}`,
    });
  }

  public async getExecutionState(query: {
    readonly executionJobId: string;
    readonly workspaceId: string;
  }): Promise<ImageManipulationExecutionStateSnapshot | undefined> {
    const state = this.states.get(query.executionJobId);
    if (!state || state.workspaceId !== query.workspaceId) {
      return undefined;
    }
    return state;
  }

  public async listExecutionProgress(input: {
    readonly executionJobId: string;
    readonly workspaceId: string;
    readonly afterSequence?: number;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ImageManipulationExecutionProgressEvent>> {
    const events = this.progress.get(input.executionJobId) ?? [];
    const filtered = typeof input.afterSequence === "number"
      ? events.filter((event) => event.sequence > input.afterSequence)
      : events;
    return typeof input.limit === "number" ? filtered.slice(0, input.limit) : filtered;
  }

  public async subscribeToExecutionProgress(
    input: {
      readonly executionJobId: string;
      readonly workspaceId: string;
    },
    sink: (event: ImageManipulationExecutionProgressEvent) => void,
  ): Promise<() => void> {
    const events = await this.listExecutionProgress({
      executionJobId: input.executionJobId,
      workspaceId: input.workspaceId,
    });
    for (const event of events) {
      sink(event);
    }
    return () => undefined;
  }

  public async requestExecutionCancellation(_input: {
    readonly executionJobId: string;
    readonly runId: string;
    readonly workspaceId: string;
    readonly requestedAt: string;
    readonly requestedByActorId?: string;
    readonly reason?: string;
  }): Promise<{
    readonly status: "accepted" | "already-terminal" | "not-supported" | "rejected" | "not-found" | "failed";
    readonly acknowledgedAt?: string;
    readonly message?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }> {
    return Object.freeze({
      status: ImageManipulationExecutionCancellationStatuses.accepted,
      acknowledgedAt: "2026-04-08T18:00:20.000Z",
    });
  }

  public async listExecutionOutputs(query: {
    readonly executionJobId: string;
    readonly workspaceId: string;
  }): Promise<ImageManipulationExecutionOutputSnapshot | undefined> {
    const output = this.outputs.get(query.executionJobId);
    if (!output || output.workspaceId !== query.workspaceId) {
      return undefined;
    }
    return output;
  }

  public async getExecutionBackendStatus(_input: {
    readonly workspaceId: string;
    readonly systemId?: string;
    readonly operationKind?: string;
    readonly translationContractVersion?: string;
  }): Promise<ImageManipulationExecutionBackendStatus> {
    return Object.freeze({
      backendFamily: "adapter.comfyui.image-manipulation",
      health: ImageManipulationExecutionBackendHealthStates.healthy,
      checkedAt: "2026-04-08T18:05:00.000Z",
      message: "ready",
      capabilities: Object.freeze({
        backendFamily: "adapter.comfyui.image-manipulation",
        supportsProgressPolling: true,
        supportsProgressStreaming: true,
        supportsCancellation: true,
        supportsOutputDiscovery: true,
        supportedOperationKinds: Object.freeze(["image-to-image", "enhance-upscale"]),
        supportedTranslationContractVersions: Object.freeze(["1.0.0"]),
      }),
    });
  }
}

describe("image manipulation execution application ports", () => {
  it("supports dispatch, state/progress reads, output discovery, and cancellation without backend DTO leakage", async () => {
    const adapter = new InMemoryImageManipulationExecutionAdapter();
    const ports: ImageManipulationExecutionPorts = {
      dispatch: adapter,
      stateQuery: adapter,
      progress: adapter,
      cancellation: adapter,
      outputs: adapter,
      capabilities: adapter,
    };

    const dispatchResult = await ports.dispatch.dispatchExecution({
      requestId: "request-1",
      runId: "run-1",
      workspaceId: "workspace-alpha",
      workflow: {
        workflowId: "workflow-image-1",
        workflowVersionTag: "1.0.0",
        workflowRevision: 2,
        operationKind: "image-to-image",
        backendTranslation: {
          translatorId: "translator:image-to-image",
          contractVersion: "1.0.0",
          templateId: "template:image-to-image",
          inputBindings: [{
            inputId: "source-image",
            backendField: "inputs.source",
          }],
          parameterBindings: [{
            parameterId: "prompt",
            backendField: "inputs.prompt",
          }],
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
      parameters: Object.freeze({
        prompt: "cinematic portrait",
      }),
      requestedAt: "2026-04-08T18:00:00.000Z",
      requestedByActorId: "user-1",
    });

    expect(dispatchResult.initialState).toBe(ImageManipulationExecutionStates.queued);
    expect(dispatchResult.backendFamily).toBe("adapter.comfyui.image-manipulation");

    const state = await ports.stateQuery.getExecutionState({
      executionJobId: dispatchResult.executionJobId,
      workspaceId: "workspace-alpha",
    });
    expect(state?.state).toBe(ImageManipulationExecutionStates.running);
    expect(state?.progressPercent).toBe(65);

    const progressEvents = await ports.progress.listExecutionProgress({
      executionJobId: dispatchResult.executionJobId,
      workspaceId: "workspace-alpha",
      afterSequence: 1,
    });
    expect(progressEvents).toHaveLength(1);
    expect(progressEvents[0]?.kind).toBe(ImageManipulationExecutionProgressEventKinds.heartbeat);

    const collectedKinds: string[] = [];
    const unsubscribe = await ports.progress.subscribeToExecutionProgress(
      {
        executionJobId: dispatchResult.executionJobId,
        workspaceId: "workspace-alpha",
      },
      (event) => collectedKinds.push(event.kind),
    );
    unsubscribe();
    expect(collectedKinds).toEqual(["started", "heartbeat"]);

    const outputs = await ports.outputs.listExecutionOutputs({
      executionJobId: dispatchResult.executionJobId,
      workspaceId: "workspace-alpha",
    });
    expect(outputs?.outputs).toHaveLength(1);
    expect(outputs?.outputs[0]?.kind).toBe(ImageManipulationExecutionOutputReferenceKinds.assetReference);

    const cancellation = await ports.cancellation.requestExecutionCancellation({
      executionJobId: dispatchResult.executionJobId,
      runId: dispatchResult.runId,
      workspaceId: "workspace-alpha",
      requestedAt: "2026-04-08T18:00:20.000Z",
      reason: "user requested",
    });
    expect(cancellation.status).toBe(ImageManipulationExecutionCancellationStatuses.accepted);
  });

  it("provides backend health and capability checks through a transport-agnostic capability port", async () => {
    const adapter = new InMemoryImageManipulationExecutionAdapter();
    const status = await adapter.getExecutionBackendStatus({
      workspaceId: "workspace-alpha",
      operationKind: "image-to-image",
      translationContractVersion: "1.0.0",
    });

    expect(status.health).toBe(ImageManipulationExecutionBackendHealthStates.healthy);
    expect(status.capabilities.supportsProgressPolling).toBeTrue();
    expect(status.capabilities.supportedOperationKinds).toContain("image-to-image");
    expect(status.capabilities.supportedTranslationContractVersions).toContain("1.0.0");
  });
});
