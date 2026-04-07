import type {
  ComfyAdapterLifecycleStatus,
} from "../execution/comfyui/ComfyAdapterContract";
import type {
  ComfyImageManipulationExecutionProgressSnapshot,
  ComfyImageManipulationExecutionResult,
} from "./ComfyImageManipulationExecutionAdapterContract";

export const ImageManipulationExecutionLifecycleStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed",
  canceled: "canceled",
});

export type ImageManipulationExecutionLifecycleStatus =
  typeof ImageManipulationExecutionLifecycleStatuses[keyof typeof ImageManipulationExecutionLifecycleStatuses];

export interface ImageManipulationExecutionLifecycleSnapshot {
  readonly executionId: string;
  readonly status: ImageManipulationExecutionLifecycleStatus;
  readonly progressPercent: number;
  readonly message?: string;
  readonly queuePosition?: number;
  readonly updatedAt: string;
  readonly terminal: boolean;
  readonly error?: Readonly<{
    readonly code: string;
    readonly category: string;
    readonly message: string;
    readonly retryable: boolean;
  }>;
}

function mapStatus(status: ComfyAdapterLifecycleStatus): ImageManipulationExecutionLifecycleStatus {
  if (status === "completed") return ImageManipulationExecutionLifecycleStatuses.succeeded;
  if (status === "cancelled") return ImageManipulationExecutionLifecycleStatuses.canceled;
  return status;
}

function normalizePercent(input: {
  readonly status: ImageManipulationExecutionLifecycleStatus;
  readonly percent?: number;
}): number {
  if (typeof input.percent === "number") {
    return Math.max(0, Math.min(100, Math.floor(input.percent)));
  }
  if (input.status === "queued") return 0;
  if (input.status === "running") return 50;
  return 100;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class ComfyImageManipulationExecutionLifecycleTracker {
  private readonly snapshots: ImageManipulationExecutionLifecycleSnapshot[] = [];

  public constructor(private readonly executionId: string) {}

  public pushProgress(progress: ComfyImageManipulationExecutionProgressSnapshot): ImageManipulationExecutionLifecycleSnapshot {
    const status = mapStatus(progress.status);
    const snapshot = Object.freeze({
      executionId: this.executionId,
      status,
      progressPercent: normalizePercent({ status, percent: progress.percent }),
      message: progress.message,
      queuePosition: progress.queuePosition,
      updatedAt: progress.updatedAt,
      terminal: status === "succeeded" || status === "failed" || status === "canceled",
    });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  public complete(result: ComfyImageManipulationExecutionResult): ImageManipulationExecutionLifecycleSnapshot {
    const status = result.status === "completed"
      ? ImageManipulationExecutionLifecycleStatuses.succeeded
      : result.status === "cancelled"
        ? ImageManipulationExecutionLifecycleStatuses.canceled
        : ImageManipulationExecutionLifecycleStatuses.failed;

    const snapshot = Object.freeze({
      executionId: result.executionId ?? this.executionId,
      status,
      progressPercent: 100,
      message: result.status === "completed"
        ? "Image generation completed."
        : result.error.message,
      updatedAt: nowIso(),
      terminal: true,
      error: result.status === "completed"
        ? undefined
        : Object.freeze({
          code: result.error.code,
          category: result.error.category,
          message: result.error.message,
          retryable: result.error.retryable,
        }),
    });

    this.snapshots.push(snapshot);
    return snapshot;
  }

  public getSnapshots(): ReadonlyArray<ImageManipulationExecutionLifecycleSnapshot> {
    return Object.freeze([...this.snapshots]);
  }

  public getLatest(): ImageManipulationExecutionLifecycleSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }
}
