import type {
  ComfyImageManipulationExecutionFailure,
  ComfyImageManipulationExecutionSubmission,
  ComfyImageManipulationGraphBuildRequest,
  IComfyImageManipulationExecutionAdapter,
} from "./ComfyImageManipulationExecutionAdapterContract";
import {
  ComfyImageManipulationExecutionLifecycleTracker,
  type ImageManipulationExecutionLifecycleSnapshot,
} from "./ComfyImageManipulationExecutionLifecycle";
import {
  createComfyExecutionReadinessFailure,
  ComfyImageManipulationExecutionReadinessError,
  validateComfyImageManipulationExecutionReadiness,
} from "./ComfyImageManipulationExecutionValidation";

export interface ExecuteComfyImageManipulationRequest extends ComfyImageManipulationGraphBuildRequest {
  readonly pollIntervalMs?: number;
}

export interface ExecuteComfyImageManipulationResult {
  readonly executionId: string;
  readonly lifecycle: ReadonlyArray<ImageManipulationExecutionLifecycleSnapshot>;
  readonly final: ImageManipulationExecutionLifecycleSnapshot;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ComfyImageManipulationExecutionService {
  public constructor(
    private readonly adapter: IComfyImageManipulationExecutionAdapter,
  ) {}

  public async execute(
    request: ExecuteComfyImageManipulationRequest,
  ): Promise<ExecuteComfyImageManipulationResult> {
    const readiness = validateComfyImageManipulationExecutionReadiness(request);
    if (!readiness.ready) {
      const executionId = request.runtimeMetadata.executionId
        ?? `${request.workflowTemplate.templateId}:validation:${Date.now().toString(36)}`;
      const tracker = new ComfyImageManipulationExecutionLifecycleTracker(executionId);
      const failure = createComfyExecutionReadinessFailure(readiness, executionId);
      const final = tracker.complete(failure);
      return Object.freeze({
        executionId,
        lifecycle: tracker.getSnapshots(),
        final,
      });
    }

    try {
      const submission = this.buildSubmission(request);
      return this.runSubmission(submission, request.pollIntervalMs);
    } catch (error) {
      if (error instanceof ComfyImageManipulationExecutionReadyError) {
        const executionId = error.failure.executionId
          ?? `${request.workflowTemplate.templateId}:failed:${Date.now().toString(36)}`;
        const tracker = new ComfyImageManipulationExecutionLifecycleTracker(executionId);
        const final = tracker.complete({
          ...error.failure,
          executionId,
        });
        return Object.freeze({
          executionId,
          lifecycle: tracker.getSnapshots(),
          final,
        });
      }
      throw error;
    }
  }

  private buildSubmission(request: ComfyImageManipulationGraphBuildRequest): ComfyImageManipulationExecutionSubmission {
    try {
      return this.adapter.buildGraphRequest(request);
    } catch (error) {
      if (error instanceof ComfyImageManipulationExecutionReadinessError) {
        throw new ComfyImageManipulationExecutionReadyError(error.failure);
      }
      const message = error instanceof Error ? error.message : "Unable to build Comfy execution request.";
      const prefixed = message.startsWith("invalid-request:") ? message.slice("invalid-request:".length) : message;
      const failure = Object.freeze({
        status: "failed",
        executionId: request.runtimeMetadata.executionId,
        error: Object.freeze({
          code: "invalid-request",
          category: "validation",
          message: prefixed,
          retryable: false,
          details: Object.freeze({
            stage: "request-construction",
            rawMessage: message,
          }),
        }),
      }) satisfies ComfyImageManipulationExecutionFailure;

      throw new ComfyImageManipulationExecutionReadyError(failure);
    }
  }

  private async runSubmission(
    submission: ComfyImageManipulationExecutionSubmission,
    pollIntervalMsOverride?: number,
  ): Promise<ExecuteComfyImageManipulationResult> {
    try {
      const accepted = await this.adapter.submitExecution(submission);
      const tracker = new ComfyImageManipulationExecutionLifecycleTracker(accepted.executionId);

      tracker.pushProgress({
        executionId: accepted.executionId,
        status: "queued",
        percent: 0,
        message: "Execution request accepted.",
        updatedAt: new Date().toISOString(),
      });

      const pollIntervalMs = pollIntervalMsOverride ?? 300;
      let done = false;

      const poller = (async () => {
        while (!done) {
          const progress = await this.adapter.getExecutionProgress(accepted.executionId);
          tracker.pushProgress(progress);
          if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
            return;
          }
          await delay(pollIntervalMs);
        }
      })();

      const result = await this.adapter.waitForExecutionResult(accepted.executionId);
      done = true;
      const final = tracker.complete(result);
      await poller;

      return Object.freeze({
        executionId: accepted.executionId,
        lifecycle: tracker.getSnapshots(),
        final,
      });
    } catch (error) {
      if (error instanceof ComfyImageManipulationExecutionReadyError) {
        const executionId = error.failure.executionId
          ?? `${submission.executionRequestId}:failed`;
        const tracker = new ComfyImageManipulationExecutionLifecycleTracker(executionId);
        const final = tracker.complete({
          ...error.failure,
          executionId,
        });
        return Object.freeze({
          executionId,
          lifecycle: tracker.getSnapshots(),
          final,
        });
      }
      throw error;
    }
  }
}

class ComfyImageManipulationExecutionReadyError extends Error {
  public constructor(public readonly failure: ComfyImageManipulationExecutionFailure) {
    super(failure.error.message);
    this.name = "ComfyImageManipulationExecutionReadyError";
  }
}
