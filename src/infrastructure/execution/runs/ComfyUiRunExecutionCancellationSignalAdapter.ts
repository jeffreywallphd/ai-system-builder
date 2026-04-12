import {
  type IRunExecutionCancellationSignalPort,
  RunCancellationSignalStatuses,
  type RunExecutionCancellationSignalRequest,
  type RunExecutionCancellationSignalResult,
} from "@application/runs/ports/RunExecutionCancellationPorts";
import { RunExecutionBackendKinds } from "@application/runs/ports/RunExecutionDispatchPorts";
import {
  ImageManipulationExecutionCancellationStatuses,
  type IImageManipulationExecutionCancellationPort,
} from "@application/image-workflows/ports";

interface ComfyUiRunExecutionCancellationSignalAdapterDependencies {
  readonly cancellationPort: IImageManipulationExecutionCancellationPort;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

export class ComfyUiRunExecutionCancellationSignalAdapter implements IRunExecutionCancellationSignalPort {
  public constructor(private readonly dependencies: ComfyUiRunExecutionCancellationSignalAdapterDependencies) {}

  public async signalCancellation(
    request: RunExecutionCancellationSignalRequest,
  ): Promise<RunExecutionCancellationSignalResult> {
    if (request.backendKind && request.backendKind !== RunExecutionBackendKinds.comfyUi) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.notSupported,
        safeCode: "backend-not-supported",
        safeMessage: `Cancellation signaling is unavailable for backend '${request.backendKind}'.`,
      });
    }

    const backendRunId = normalizeOptional(request.backendRunId);
    if (!backendRunId) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.failed,
        safeCode: "backend-run-id-missing",
        safeMessage: "Cancellation signaling requires a backend run identifier.",
      });
    }

    const workspaceId = normalizeOptional(request.workspaceId);
    if (!workspaceId) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.failed,
        safeCode: "workspace-id-missing",
        safeMessage: "Cancellation signaling requires a workspace identifier.",
      });
    }

    const cancellation = await this.dependencies.cancellationPort.requestExecutionCancellation({
      executionJobId: backendRunId,
      runId: request.runId,
      workspaceId,
      requestedAt: request.requestedAt,
      requestedByActorId: request.requestedByActorId,
      reason: request.reason,
    });
    const details = toRecord(cancellation.details);

    if (
      cancellation.status === ImageManipulationExecutionCancellationStatuses.accepted
      || cancellation.status === ImageManipulationExecutionCancellationStatuses.alreadyTerminal
    ) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.accepted,
        acknowledgedAt: cancellation.acknowledgedAt,
        safeCode: "cancel-signal-accepted",
        safeMessage: cancellation.message ?? "Cancellation signal was accepted.",
        metadata: details,
      });
    }

    if (cancellation.status === ImageManipulationExecutionCancellationStatuses.notSupported) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.notSupported,
        acknowledgedAt: cancellation.acknowledgedAt,
        safeCode: "cancel-signal-not-supported",
        safeMessage: cancellation.message ?? "Execution backend does not support cancellation signaling.",
        metadata: details,
      });
    }

    if (cancellation.status === ImageManipulationExecutionCancellationStatuses.rejected) {
      return Object.freeze({
        status: RunCancellationSignalStatuses.rejected,
        acknowledgedAt: cancellation.acknowledgedAt,
        safeCode: "cancel-signal-rejected",
        safeMessage: cancellation.message ?? "Cancellation signal was rejected by execution backend.",
        metadata: details,
      });
    }

    return Object.freeze({
      status: RunCancellationSignalStatuses.failed,
      acknowledgedAt: cancellation.acknowledgedAt,
      safeCode: cancellation.status === ImageManipulationExecutionCancellationStatuses.notFound
        ? "cancel-signal-target-not-found"
        : "cancel-signal-failed",
      safeMessage: cancellation.message ?? "Cancellation signal could not be completed.",
      metadata: details,
    });
  }
}
