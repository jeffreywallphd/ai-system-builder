import { describe, expect, it } from "bun:test";
import {
  DeferredFeatureApiUnavailableCode,
  createDeferredBridgeGuards,
  createDeferredFeatureUnavailableError,
} from "../bridge/deferredFeatureGuards";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
} from "../../shared/DesktopContracts";

describe("deferred preload guards", () => {
  it("throws/rejects unavailable errors and triggers warmup when runtime is not ready", async () => {
    let warmups = 0;
    const guards = createDeferredBridgeGuards({
      isDeferredFeatureApiReady: () => false,
      getPostLoginRuntimeStatus: () => ({
        host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
        state: DesktopPostLoginRuntimeStates.preLogin,
        capabilityPhase: DesktopPostLoginRuntimeStates.preLogin,
        unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
        updatedAt: "2026-04-11T00:00:00.000Z",
        transport: {
          phase: DesktopControlPlaneTransportPhases.available,
          updatedAt: "2026-04-11T00:00:00.000Z",
        },
      }),
      startDeferredFeatureWarmupOnDemand: () => {
        warmups += 1;
      },
    });

    const syncBridge = guards.guardDeferredSyncGroup("modelFiles", {
      exists: () => true,
    });
    const asyncBridge = guards.guardDeferredAsyncGroup("registry", {
      listAssets: async () => "ok",
    });

    expect(() => syncBridge.exists()).toThrow("Requested API: modelFiles.exists");
    await expect(asyncBridge.listAssets()).rejects.toThrow("Requested API: registry.listAssets");
    expect(warmups).toBe(2);
  });

  it("creates unavailable errors with stable code and runtime reason", () => {
    const error = createDeferredFeatureUnavailableError("agents.launchAgent", () => ({
      host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
      state: DesktopPostLoginRuntimeStates.preLogin,
      capabilityPhase: DesktopPostLoginRuntimeStates.preLogin,
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.loggedOut,
      updatedAt: "2026-04-11T00:00:00.000Z",
      transport: {
        phase: DesktopControlPlaneTransportPhases.available,
        updatedAt: "2026-04-11T00:00:00.000Z",
      },
    }));

    expect(error.code).toBe(DeferredFeatureApiUnavailableCode);
    expect(error.message).toContain("logged-out");
    expect(error.message).toContain("Requested API: agents.launchAgent");
  });
});
