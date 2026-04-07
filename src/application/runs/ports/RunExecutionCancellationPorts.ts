import type { RunExecutionBackendKind } from "@application/runs/ports/RunExecutionDispatchPorts";

export const RunCancellationSignalStatuses = Object.freeze({
  accepted: "accepted",
  notSupported: "not-supported",
  rejected: "rejected",
  failed: "failed",
});

export type RunCancellationSignalStatus =
  typeof RunCancellationSignalStatuses[keyof typeof RunCancellationSignalStatuses];

export interface RunExecutionCancellationSignalRequest {
  readonly runId: string;
  readonly workflowId: string;
  readonly workspaceId?: string;
  readonly state: string;
  readonly backendKind?: RunExecutionBackendKind;
  readonly backendRunId?: string;
  readonly assignedNodeId?: string;
  readonly requestedAt: string;
  readonly requestedByActorId?: string;
  readonly reason?: string;
}

export interface RunExecutionCancellationSignalResult {
  readonly status: RunCancellationSignalStatus;
  readonly acknowledgedAt?: string;
  readonly safeCode?: string;
  readonly safeMessage?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IRunExecutionCancellationSignalPort {
  signalCancellation(
    request: RunExecutionCancellationSignalRequest,
  ): Promise<RunExecutionCancellationSignalResult>;
}
