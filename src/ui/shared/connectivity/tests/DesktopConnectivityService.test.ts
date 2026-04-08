import { describe, expect, it } from "bun:test";
import { DesktopConnectivityService } from "../DesktopConnectivityService";

describe("DesktopConnectivityService", () => {
  it("reads and parses desktop connectivity state from bridge payloads", async () => {
    const service = new DesktopConnectivityService();
    const state = await service.getConnectivityState({
      connectivity: {
        async getConnectivityState() {
          return JSON.stringify({
            state: "connected",
            stale: false,
            localModeActive: false,
            reasonCode: "online",
            lastChangedAt: "2026-04-07T12:00:00.000Z",
            canQueueOperations: true,
            canResynchronize: true,
          });
        },
        async setOfflineMode() {
          return "";
        },
      },
    });

    expect(state?.state).toBe("connected");
    expect(state?.reasonCode).toBe("online");
  });

  it("sets deliberate offline mode through desktop bridge", async () => {
    const service = new DesktopConnectivityService();
    const state = await service.setOfflineMode({ active: true, detail: "manual" }, {
      connectivity: {
        async getConnectivityState() {
          return "";
        },
        async setOfflineMode(requestJson: string) {
          const request = JSON.parse(requestJson) as { readonly active: boolean; readonly detail?: string };
          expect(request.active).toBeTrue();
          expect(request.detail).toBe("manual");
          return JSON.stringify({
            state: "disconnected",
            stale: true,
            localModeActive: true,
            reasonCode: "offline-mode-deliberate",
            offlineModeIntent: "deliberate",
            lastChangedAt: "2026-04-07T12:00:00.000Z",
            canQueueOperations: true,
            canResynchronize: false,
          });
        },
      },
    });

    expect(state?.state).toBe("disconnected");
    expect(state?.offlineModeIntent).toBe("deliberate");
  });

  it("reads and parses synchronization snapshot when bridge supports it", async () => {
    const service = new DesktopConnectivityService();
    const snapshot = await service.getSynchronizationStateSnapshot({
      connectivity: {
        async getConnectivityState() {
          return "";
        },
        async setOfflineMode() {
          return "";
        },
        async getSynchronizationStateSnapshot() {
          return JSON.stringify({
            contractVersion: "offline-sync/v1",
            workspaceId: "workspace:alpha",
            cachedResources: [],
            drafts: [],
            queue: {
              queueId: "queue:alpha",
              operations: [],
              localExecutionRegistrations: [],
              pendingRunSubmissions: [],
              outcomes: [],
              updatedAt: "2026-04-07T12:00:00.000Z",
            },
            status: {
              state: "idle",
              pendingOperationCount: 0,
              conflictCount: 0,
              rejectedCount: 0,
            },
            connectivity: {
              state: "connected",
              stale: false,
              localModeActive: false,
              reasonCode: "online",
              lastChangedAt: "2026-04-07T12:00:00.000Z",
              canQueueOperations: true,
              canResynchronize: true,
            },
          });
        },
      },
    });

    expect(snapshot?.workspaceId).toBe("workspace:alpha");
    expect(snapshot?.queue.queueId).toBe("queue:alpha");
  });

  it("builds a canonical fallback synchronization snapshot from connectivity state", async () => {
    const service = new DesktopConnectivityService();
    const snapshot = await service.getSynchronizationStateSnapshot({
      connectivity: {
        async getConnectivityState() {
          return JSON.stringify({
            state: "disconnected",
            stale: true,
            localModeActive: true,
            reasonCode: "offline-mode-deliberate",
            offlineModeIntent: "deliberate",
            lastChangedAt: "2026-04-07T12:00:00.000Z",
            canQueueOperations: true,
            canResynchronize: false,
          });
        },
        async setOfflineMode() {
          return "";
        },
      },
    });

    expect(snapshot?.contractVersion).toBe("offline-sync/v1");
    expect(snapshot?.workspaceId).toBe("desktop-local");
    expect(snapshot?.status.state).toBe("idle");
    expect(snapshot?.connectivity.state).toBe("disconnected");
  });
});
