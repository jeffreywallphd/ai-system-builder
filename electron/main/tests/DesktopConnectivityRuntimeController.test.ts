import { describe, expect, it } from "bun:test";
import {
  DeferredConnectivityStateDetail,
  createDesktopConnectivityRuntimeController,
} from "../DesktopConnectivityRuntimeController";

describe("createDesktopConnectivityRuntimeController", () => {
  it("returns deferred connectivity placeholder before monitoring starts", () => {
    const controller = createDesktopConnectivityRuntimeController({
      createConnectivityStateService: () => {
        throw new Error("service should not be created before monitoring starts");
      },
      createConnectivityProbePort: () => ({ probe: true }),
      lookupToken: () => null,
      nowIsoString: () => "2026-04-11T00:00:00.000Z",
    });

    expect(JSON.parse(controller.getConnectivityStateForAuthBootstrapIpc())).toEqual({
      state: "connecting",
      stale: false,
      localModeActive: false,
      detail: DeferredConnectivityStateDetail,
      lastChangedAt: "2026-04-11T00:00:00.000Z",
      canQueueOperations: true,
      canResynchronize: false,
    });
  });

  it("returns deferred placeholder for offline-mode writes before monitoring starts", () => {
    const controller = createDesktopConnectivityRuntimeController({
      createConnectivityStateService: () => ({
        getState: () => ({ state: "connected" }),
        setDeliberateOfflineMode: () => ({ state: "offline" }),
        startMonitoring: () => undefined,
        stopMonitoring: () => undefined,
      }),
      createConnectivityProbePort: () => ({ probe: true }),
      lookupToken: () => null,
      nowIsoString: () => "2026-04-11T00:00:00.000Z",
    });

    const result = JSON.parse(controller.setConnectivityOfflineModeForAuthBootstrapIpc(JSON.stringify({ active: true })));
    expect(result).toMatchObject({
      state: "connecting",
      detail: DeferredConnectivityStateDetail,
    });
  });

  it("starts monitoring with token lookup, serializes live state, and stops cleanly", () => {
    const operations: string[] = [];
    let latestState: Record<string, unknown> = { state: "connected", localModeActive: false };

    const controller = createDesktopConnectivityRuntimeController({
      createConnectivityStateService: () => ({
        getState: () => latestState,
        setDeliberateOfflineMode: (active, detail) => {
          operations.push(`offline:${active}:${detail ?? ""}`);
          latestState = { state: active ? "disconnected" : "connected", detail };
          return latestState;
        },
        startMonitoring: (_probePort, options) => {
          operations.push(`start:${options.intervalMs}`);
        },
        stopMonitoring: () => {
          operations.push("stop");
        },
      }),
      createConnectivityProbePort: (controlPlaneBaseUrl, lookupToken) => {
        operations.push(`probe:${controlPlaneBaseUrl}`);
        operations.push(`token:${lookupToken("auth-token")}`);
        return { controlPlaneBaseUrl };
      },
      lookupToken: (key) => (key === "auth-token" ? "abc123" : null),
      nowIsoString: () => "2026-04-11T00:00:00.000Z",
    });

    controller.startMonitoring("https://identity.example.test");
    controller.startMonitoring("https://identity.example.test");

    expect(controller.isMonitoringStarted()).toBe(true);
    expect(JSON.parse(controller.getConnectivityStateForAuthBootstrapIpc())).toEqual({
      state: "connected",
      localModeActive: false,
    });

    const offlineResult = JSON.parse(controller.setConnectivityOfflineModeForAuthBootstrapIpc(JSON.stringify({ active: true, detail: "manual" })));
    expect(offlineResult).toEqual({
      state: "disconnected",
      detail: "manual",
    });

    controller.stopMonitoring();
    expect(controller.isMonitoringStarted()).toBe(false);

    expect(operations).toEqual([
      "probe:https://identity.example.test",
      "token:abc123",
      "start:3000",
      "offline:true:manual",
      "stop",
    ]);
  });
});
