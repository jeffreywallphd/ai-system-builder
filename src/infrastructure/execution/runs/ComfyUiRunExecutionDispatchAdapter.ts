import {
  RunExecutionBackendKinds,
  type CanonicalRunExecutionCommand,
  type IRunExecutionBackendAdapter,
  type RunExecutionDispatchReceipt,
} from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  ImageManipulationFailureNormalizationSources,
  normalizeImageManipulationExecutionFailure,
  type ImageManipulationExecutionFailure,
} from "@application/image-workflows/ports";
import { ComfyUiTransportClientError } from "../comfyui/ComfyUiTransportClient";
import { ComfyUiExecutionObservability } from "../comfyui/ComfyUiExecutionObservability";

export interface ComfyUiDispatchPayload {
  readonly runId: string;
  readonly queueId: string;
  readonly nodeId: string;
  readonly comfyTarget: {
    readonly systemId: string;
    readonly versionId: string;
  };
  readonly workflowId: string;
  readonly inputParameters: Readonly<Record<string, unknown>>;
  readonly assetReferences: {
    readonly storageReferences: CanonicalRunExecutionCommand["references"]["storageReferences"];
    readonly resourceReferences: CanonicalRunExecutionCommand["references"]["resourceReferences"];
  };
}

export interface ComfyUiDispatchGateway {
  submitComfyUiDispatch(payload: ComfyUiDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
}

interface ComfyUiRunExecutionDispatchAdapterDependencies {
  readonly gateway: ComfyUiDispatchGateway;
  readonly now?: () => Date;
  readonly observability?: ComfyUiExecutionObservability;
}

export class ComfyUiRunExecutionDispatchError extends Error {
  public readonly failure: ImageManipulationExecutionFailure;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  public constructor(input: {
    readonly failure: ImageManipulationExecutionFailure;
    readonly cause?: unknown;
  }) {
    super(input.failure.summary);
    this.name = "ComfyUiRunExecutionDispatchError";
    this.failure = input.failure;
    this.retryable = input.failure.retryable;
    this.cause = input.cause;
  }
}

export class ComfyUiRunExecutionDispatchAdapter implements IRunExecutionBackendAdapter {
  public readonly backendKind = RunExecutionBackendKinds.comfyUi;
  private readonly now: () => Date;
  private readonly observability?: ComfyUiExecutionObservability;

  public constructor(private readonly dependencies: ComfyUiRunExecutionDispatchAdapterDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.observability = dependencies.observability;
  }

  public async dispatch(command: CanonicalRunExecutionCommand): Promise<RunExecutionDispatchReceipt> {
    this.observability?.record({
      event: "dispatch.started",
      severity: "info",
      runId: command.run.runId,
      dispatchAttemptId: command.dispatchAttemptId,
      correlationId: command.run.correlationId,
      details: Object.freeze({
        queueId: command.queue.queueId,
        nodeId: command.assignment.nodeId,
        backendKind: command.backend.kind,
        hasStorageReferences: command.references.storageReferences.length > 0,
        hasResourceReferences: command.references.resourceReferences.length > 0,
      }),
    });

    try {
      const payload: ComfyUiDispatchPayload = Object.freeze({
        runId: command.run.runId,
        queueId: command.queue.queueId,
        nodeId: command.assignment.nodeId,
        comfyTarget: Object.freeze({
          systemId: command.runtimeTarget.systemId,
          versionId: command.runtimeTarget.versionId,
        }),
        workflowId: command.run.workflowId,
        inputParameters: command.inputs.parameters,
        assetReferences: Object.freeze({
          storageReferences: command.references.storageReferences,
          resourceReferences: command.references.resourceReferences,
        }),
      });

      const dispatched = await this.dependencies.gateway.submitComfyUiDispatch(payload);
      const receipt = Object.freeze({
        dispatchId: `dispatch:${command.dispatchAttemptId}`,
        backendKind: this.backendKind,
        acceptedAt: dispatched.acceptedAt?.trim() || this.now().toISOString(),
        status: "accepted",
        backendRunId: dispatched.backendRunId,
        metadata: dispatched.metadata,
      });

      this.observability?.record({
        event: "dispatch.accepted",
        severity: "info",
        runId: command.run.runId,
        dispatchAttemptId: command.dispatchAttemptId,
        backendExecutionId: dispatched.backendRunId,
        correlationId: command.run.correlationId,
        details: Object.freeze({
          status: receipt.status,
          hasQueueNumber: typeof (dispatched.metadata as Record<string, unknown> | undefined)?.queueNumber === "number",
        }),
      });
      return receipt;
    } catch (error) {
      const failure = normalizeDispatchFailure(error, this.now().toISOString());
      this.observability?.record({
        event: "dispatch.failed",
        severity: failure.retryable ? "warn" : "error",
        runId: command.run.runId,
        dispatchAttemptId: command.dispatchAttemptId,
        correlationId: command.run.correlationId,
        details: Object.freeze({
          failureCode: failure.code,
          failureCategory: failure.category,
          retryable: failure.retryable,
          stageCode: failure.stageCode,
        }),
      });
      throw new ComfyUiRunExecutionDispatchError({
        failure,
        cause: error,
      });
    }
  }
}

function normalizeDispatchFailure(
  error: unknown,
  failedAt: string,
): ImageManipulationExecutionFailure {
  if (error instanceof ComfyUiTransportClientError) {
    return normalizeImageManipulationExecutionFailure({
      source: ImageManipulationFailureNormalizationSources.dispatch,
      failedAt,
      backendStatusCode: error.diagnostics.statusCode !== undefined
        ? String(error.diagnostics.statusCode)
        : undefined,
      backendErrorCode: error.code,
      rawMessage: error.message,
      diagnostics: error.diagnostics.details,
      stageCode: "dispatch",
      state: "failed",
      partialProgressObserved: false,
      partialOutputCount: 0,
    });
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  return normalizeImageManipulationExecutionFailure({
    source: ImageManipulationFailureNormalizationSources.dispatch,
    failedAt,
    backendErrorCode: "dispatch-error",
    rawMessage,
    diagnostics: error instanceof Error
      ? Object.freeze({
        name: error.name,
      })
      : undefined,
    stageCode: "dispatch",
    state: "failed",
    partialProgressObserved: false,
    partialOutputCount: 0,
  });
}

