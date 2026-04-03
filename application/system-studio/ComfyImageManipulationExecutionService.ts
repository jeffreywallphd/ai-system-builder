import {
  buildComfyImageManipulationExecutionSubmission,
} from "./ComfyImageManipulationGraphRequestBuilder";
import type {
  ComfyImageManipulationGraphBuildRequest,
  IComfyImageManipulationExecutionAdapter,
} from "./ComfyImageManipulationExecutionAdapterContract";
import {
  ComfyImageManipulationExecutionLifecycleTracker,
  type ImageManipulationExecutionLifecycleSnapshot,
} from "./ComfyImageManipulationExecutionLifecycle";

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
    const submission = buildComfyImageManipulationExecutionSubmission(request);
    const accepted = await this.adapter.submitExecution(submission);
    const tracker = new ComfyImageManipulationExecutionLifecycleTracker(accepted.executionId);

    tracker.pushProgress({
      executionId: accepted.executionId,
      status: "queued",
      percent: 0,
      message: "Execution request accepted.",
      updatedAt: new Date().toISOString(),
    });

    const pollIntervalMs = request.pollIntervalMs ?? 300;
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
  }
}
