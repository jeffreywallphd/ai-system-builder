import type {
  ComfyAdapterErrorCode,
  ComfyAdapterLifecycleStatus,
  IComfyAdapterError,
  IComfyAdapterLifecycleEvent,
} from "../../../application/execution/comfyui/ComfyAdapterContract";

export function mapComfyProgressToLifecycleEvent(progress: {
  readonly promptId: string;
  readonly status: ComfyAdapterLifecycleStatus;
  readonly message?: string;
  readonly queuePosition?: number;
}): IComfyAdapterLifecycleEvent {
  return Object.freeze({
    executionId: progress.promptId,
    status: progress.status,
    percent: toPercent(progress.status),
    message: progress.message,
    queuePosition: progress.queuePosition,
  });
}

export function mapComfyError(error: unknown): IComfyAdapterError {
  const message =
    error instanceof Error ? error.message : "Unknown ComfyUI execution error.";

  const normalized = message.toLowerCase();

  if (normalized.includes("timed out")) {
    return buildError("queue-timeout", message, true);
  }

  if (normalized.includes("cancel")) {
    return buildError("execution-cancelled", message, false);
  }

  if (normalized.includes("failed") || normalized.includes("error")) {
    return buildError("execution-failed", message, true);
  }

  return buildError("unknown", message, false);
}

function toPercent(status: ComfyAdapterLifecycleStatus): number | undefined {
  if (status === "queued") return 5;
  if (status === "running") return 50;
  if (status === "completed") return 100;
  return undefined;
}

function buildError(
  code: ComfyAdapterErrorCode,
  message: string,
  retriable: boolean
): IComfyAdapterError {
  return Object.freeze({
    code,
    message,
    retriable,
  });
}
