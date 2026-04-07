import type {
  RuntimeRealtimeQueueMovementPayload,
  RuntimeRealtimeRunStatusPayload,
} from "@shared/contracts/runtime/SystemRuntimeRealtimeEventContracts";
import {
  RunLifecycleStates,
  type RunLifecycleState,
} from "@domain/runs/RunDomain";
import type { RunDetail } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

export interface RunOrchestrationRealtimePublisher {
  publishRunStatus(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeRunStatusPayload;
  }): void;
  publishQueueMovement(input: {
    readonly actorUserIdentityId?: string;
    readonly workspaceId?: string;
    readonly payload: RuntimeRealtimeQueueMovementPayload;
  }): void;
}

export const RuntimeQueueMovementStatuses = Object.freeze({
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export function mapRunLifecycleStateToQueueMovementStatus(
  state: RunLifecycleState,
): RuntimeRealtimeQueueMovementPayload["status"] {
  switch (state) {
    case RunLifecycleStates.completed:
      return RuntimeQueueMovementStatuses.completed;
    case RunLifecycleStates.failed:
      return RuntimeQueueMovementStatuses.failed;
    case RunLifecycleStates.cancelled:
      return RuntimeQueueMovementStatuses.cancelled;
    case RunLifecycleStates.running:
    case RunLifecycleStates.cancelling:
      return RuntimeQueueMovementStatuses.running;
    default:
      return RuntimeQueueMovementStatuses.queued;
  }
}

export async function publishRunOrchestrationRealtimeEventsBestEffort(
  action: () => void | Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch {
    // Intentionally best-effort so realtime publication does not block authoritative mutations.
  }
}

export function buildRunStatusPayload(input: {
  readonly run: RunDetail;
  readonly eventKind: RuntimeRealtimeRunStatusPayload["eventKind"];
  readonly changedAt: string;
}): RuntimeRealtimeRunStatusPayload {
  return Object.freeze({
    executionId: input.run.runId,
    runId: input.run.runId,
    workflowId: input.run.workflowId,
    queueId: input.run.queue?.queueId,
    lifecycleState: input.run.state,
    eventKind: input.eventKind,
    status: input.run.state,
    changedAt: input.changedAt,
  });
}

export function buildQueueMovementPayload(input: {
  readonly run: RunDetail;
  readonly eventKind: RuntimeRealtimeQueueMovementPayload["eventKind"];
  readonly changedAt: string;
}): RuntimeRealtimeQueueMovementPayload {
  return Object.freeze({
    queueItemId: `runtime-queue:${input.run.runId}`,
    executionId: input.run.runId,
    runId: input.run.runId,
    workflowId: input.run.workflowId,
    queueId: input.run.queue?.queueId,
    lifecycleState: input.run.state,
    eventKind: input.eventKind,
    status: mapRunLifecycleStateToQueueMovementStatus(input.run.state),
    position: input.run.queue?.position ?? undefined,
    changedAt: input.changedAt,
  });
}
