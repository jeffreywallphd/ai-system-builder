import { describe, expect, it } from "bun:test";
import { NodeInventoryOperationalStates, NodeInventoryPresenceStates } from "@shared/contracts/nodes/NodeTrustApiContracts";
import {
  buildOperationalWorkspaceDashboardModel,
  type BuildOperationalWorkspaceDashboardModelInput,
} from "../OperationalWorkspaceDashboardPresenter";

describe("OperationalWorkspaceDashboardPresenter", () => {
  it("builds summary counts and actionable alerts from queue/run/node contracts", () => {
    const model = buildOperationalWorkspaceDashboardModel(createInput());

    expect(model.queue.totalCount).toBe(2);
    expect(model.queue.queuedCount).toBe(1);
    expect(model.runs.failedCount).toBe(1);
    expect(model.outputs.totalCount).toBe(1);
    expect(model.nodes.onlineCount).toBe(1);
    expect(model.nodes.offlineCount).toBe(1);
    expect(model.alerts.length).toBeGreaterThan(0);
    expect(model.alerts.some((alert) => alert.id === "alert:failed-runs")).toBe(true);
    expect(model.alerts.some((alert) => alert.id === "alert:node-availability")).toBe(true);
  });
});

function createInput(): BuildOperationalWorkspaceDashboardModelInput {
  return Object.freeze({
    queueItems: Object.freeze([
      Object.freeze({
        queueItemId: "queue:1",
        executionId: "run:queued",
        systemId: "system:alpha",
        status: "queued",
        enqueuedAt: "2026-04-07T11:00:00.000Z",
      }),
      Object.freeze({
        queueItemId: "queue:2",
        executionId: "run:running",
        systemId: "system:beta",
        status: "running",
        enqueuedAt: "2026-04-07T11:03:00.000Z",
      }),
    ]),
    recentRuns: Object.freeze([
      Object.freeze({
        runId: "run:failed",
        planId: "plan:failed",
        status: "failed",
        statusLabel: "Failed",
        statusTone: "danger",
        completedUnits: 2,
        totalUnits: 5,
        progressPercent: 40,
        progressLabel: "2/5 units",
        executionPathLabel: "Real execution",
        startedAt: "2026-04-07T10:00:00.000Z",
        updatedAt: "2026-04-07T10:02:00.000Z",
        durationSummary: "2m",
      }),
    ]),
    recentOutputs: Object.freeze([
      Object.freeze({
        executionId: "run:completed",
        status: "completed",
        outputFieldCount: 4,
        outputContractIds: Object.freeze(["contract:one", "contract:two"]),
      }),
    ]),
    nodeInventory: Object.freeze([
      Object.freeze({
        nodeId: "node:online",
        nodeType: "compute",
        displayName: "Online Node",
        approvalStatus: "approved",
        trustState: "trusted",
        operationalState: NodeInventoryOperationalStates.active,
        presenceState: NodeInventoryPresenceStates.online,
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["executor"]),
          supportsRemoteScheduling: true,
        }),
        deploymentTags: Object.freeze(["prod"]),
        revocation: Object.freeze({ state: "active" }),
      }),
      Object.freeze({
        nodeId: "node:offline",
        nodeType: "compute",
        displayName: "Offline Node",
        approvalStatus: "approved",
        trustState: "trusted",
        operationalState: NodeInventoryOperationalStates.offline,
        presenceState: NodeInventoryPresenceStates.offline,
        capabilityProfile: Object.freeze({
          enabledCapabilities: Object.freeze(["executor"]),
          supportsRemoteScheduling: true,
        }),
        deploymentTags: Object.freeze(["prod"]),
        revocation: Object.freeze({ state: "active" }),
      }),
    ]),
    realtime: Object.freeze({
      state: "degraded",
      stale: true,
      detail: "Connection dropped.",
    }),
  });
}
