import type { ExecutionRunProjection } from "@application/execution/ExecutionRunProjectionService";
import type { RuntimeQueueItem } from "@shared/contracts/runtime/SystemRuntimeTransportContracts";
import {
  NodeInventoryOperationalStates,
  NodeInventoryPresenceStates,
  type NodeInventorySummaryDto,
} from "@shared/contracts/nodes/NodeTrustApiContracts";
import type { RuntimeRealtimeConnectionStateSnapshot } from "../shared/runtime/RuntimeRealtimeSubscriptionService";

export interface OperationalWorkspaceRecentOutputSummary {
  readonly executionId: string;
  readonly status?: string;
  readonly rootAssetId?: string;
  readonly rootVersionId?: string;
  readonly outputFieldCount: number;
  readonly outputContractIds: ReadonlyArray<string>;
  readonly outputAssetIds?: ReadonlyArray<string>;
}

export interface OperationalWorkspaceAlertDescriptor {
  readonly id: string;
  readonly tone: "neutral" | "success" | "warning" | "danger";
  readonly title: string;
  readonly message: string;
  readonly action:
    | { readonly kind: "refresh-queue"; readonly label: string }
    | { readonly kind: "inspect-run"; readonly label: string; readonly executionId: string }
    | { readonly kind: "open-node-inventory"; readonly label: string }
    | { readonly kind: "none" };
}

export interface OperationalWorkspaceDashboardModel {
  readonly queue: {
    readonly totalCount: number;
    readonly queuedCount: number;
    readonly runningCount: number;
  };
  readonly runs: {
    readonly totalCount: number;
    readonly failedCount: number;
    readonly cancelledCount: number;
    readonly runningCount: number;
  };
  readonly outputs: {
    readonly totalCount: number;
    readonly contractCount: number;
  };
  readonly nodes: {
    readonly totalCount: number;
    readonly onlineCount: number;
    readonly degradedCount: number;
    readonly offlineCount: number;
    readonly pendingCount: number;
    readonly revokedCount: number;
  };
  readonly realtime: RuntimeRealtimeConnectionStateSnapshot;
  readonly alerts: ReadonlyArray<OperationalWorkspaceAlertDescriptor>;
}

export interface BuildOperationalWorkspaceDashboardModelInput {
  readonly queueItems: ReadonlyArray<RuntimeQueueItem>;
  readonly recentRuns: ReadonlyArray<ExecutionRunProjection>;
  readonly recentOutputs: ReadonlyArray<OperationalWorkspaceRecentOutputSummary>;
  readonly nodeInventory: ReadonlyArray<NodeInventorySummaryDto>;
  readonly realtime: RuntimeRealtimeConnectionStateSnapshot;
}

const RUN_FAILURE_STATUSES = new Set(["failed"]);
const RUN_CANCELLED_STATUSES = new Set(["cancelled"]);
const RUN_RUNNING_STATUSES = new Set(["running"]);

export function buildOperationalWorkspaceDashboardModel(
  input: BuildOperationalWorkspaceDashboardModelInput,
): OperationalWorkspaceDashboardModel {
  const queueQueuedCount = input.queueItems.filter((item) => item.status === "queued").length;
  const queueRunningCount = input.queueItems.filter((item) => item.status === "running").length;

  const runFailedCount = input.recentRuns.filter((run) => RUN_FAILURE_STATUSES.has(run.status)).length;
  const runCancelledCount = input.recentRuns.filter((run) => RUN_CANCELLED_STATUSES.has(run.status)).length;
  const runRunningCount = input.recentRuns.filter((run) => RUN_RUNNING_STATUSES.has(run.status)).length;

  const outputContractCount = input.recentOutputs.reduce((total, output) => (
    total + output.outputContractIds.length
  ), 0);

  const nodesOnlineCount = input.nodeInventory.filter((node) => node.presenceState === NodeInventoryPresenceStates.online).length;
  const nodesDegradedCount = input.nodeInventory.filter((node) => node.presenceState === NodeInventoryPresenceStates.degraded).length;
  const nodesOfflineCount = input.nodeInventory.filter((node) => (
    node.presenceState === NodeInventoryPresenceStates.offline || node.presenceState === NodeInventoryPresenceStates.unknown
  )).length;
  const nodesPendingCount = input.nodeInventory.filter((node) => node.operationalState === NodeInventoryOperationalStates.pending).length;
  const nodesRevokedCount = input.nodeInventory.filter((node) => node.operationalState === NodeInventoryOperationalStates.revoked).length;

  const firstQueued = input.queueItems.find((item) => item.status === "queued");
  const failedRun = input.recentRuns.find((run) => RUN_FAILURE_STATUSES.has(run.status));
  const alerts = buildAlerts({
    realtime: input.realtime,
    queueQueuedCount,
    queueTotalCount: input.queueItems.length,
    firstQueuedExecutionId: firstQueued?.executionId,
    failedRunId: failedRun?.runId,
    failedRunCount: runFailedCount,
    offlineNodeCount: nodesOfflineCount,
    degradedNodeCount: nodesDegradedCount,
  });

  return Object.freeze({
    queue: Object.freeze({
      totalCount: input.queueItems.length,
      queuedCount: queueQueuedCount,
      runningCount: queueRunningCount,
    }),
    runs: Object.freeze({
      totalCount: input.recentRuns.length,
      failedCount: runFailedCount,
      cancelledCount: runCancelledCount,
      runningCount: runRunningCount,
    }),
    outputs: Object.freeze({
      totalCount: input.recentOutputs.length,
      contractCount: outputContractCount,
    }),
    nodes: Object.freeze({
      totalCount: input.nodeInventory.length,
      onlineCount: nodesOnlineCount,
      degradedCount: nodesDegradedCount,
      offlineCount: nodesOfflineCount,
      pendingCount: nodesPendingCount,
      revokedCount: nodesRevokedCount,
    }),
    realtime: input.realtime,
    alerts,
  });
}

function buildAlerts(input: {
  readonly realtime: RuntimeRealtimeConnectionStateSnapshot;
  readonly queueQueuedCount: number;
  readonly queueTotalCount: number;
  readonly firstQueuedExecutionId?: string;
  readonly failedRunId?: string;
  readonly failedRunCount: number;
  readonly offlineNodeCount: number;
  readonly degradedNodeCount: number;
}): ReadonlyArray<OperationalWorkspaceAlertDescriptor> {
  const alerts: OperationalWorkspaceAlertDescriptor[] = [];

  if (input.realtime.stale || input.realtime.state === "degraded" || input.realtime.state === "reconnecting") {
    alerts.push(Object.freeze({
      id: "alert:runtime-realtime-degraded",
      tone: "warning",
      title: "Realtime channel degraded",
      message: input.realtime.detail ?? "Operational updates may be delayed; use refresh for current queue and run state.",
      action: Object.freeze({ kind: "refresh-queue", label: "Refresh now" }),
    }));
  }

  if (input.queueQueuedCount >= 10) {
    alerts.push(Object.freeze({
      id: "alert:queue-depth",
      tone: input.queueQueuedCount >= 25 ? "danger" : "warning",
      title: "Queue pressure is elevated",
      message: `${input.queueQueuedCount} executions are waiting in queue (${input.queueTotalCount} active queue items).`,
      action: input.firstQueuedExecutionId
        ? Object.freeze({ kind: "inspect-run", label: "Inspect oldest queued run", executionId: input.firstQueuedExecutionId })
        : Object.freeze({ kind: "refresh-queue", label: "Refresh now" }),
    }));
  }

  if (input.failedRunCount > 0) {
    alerts.push(Object.freeze({
      id: "alert:failed-runs",
      tone: "danger",
      title: "Recent runs failed",
      message: `${input.failedRunCount} run${input.failedRunCount === 1 ? "" : "s"} failed in the recent activity window.`,
      action: input.failedRunId
        ? Object.freeze({ kind: "inspect-run", label: "Inspect latest failure", executionId: input.failedRunId })
        : Object.freeze({ kind: "none" }),
    }));
  }

  if (input.offlineNodeCount > 0 || input.degradedNodeCount > 0) {
    alerts.push(Object.freeze({
      id: "alert:node-availability",
      tone: input.offlineNodeCount > 0 ? "danger" : "warning",
      title: "Node availability requires attention",
      message: `${input.degradedNodeCount} degraded and ${input.offlineNodeCount} offline/unknown nodes detected.`,
      action: Object.freeze({ kind: "open-node-inventory", label: "Open node inventory" }),
    }));
  }

  return Object.freeze(alerts);
}
