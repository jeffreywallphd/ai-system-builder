import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
} from "../../shared/DesktopContracts";
import {
  createDeferredFeatureSurface,
  createDesktopBridge,
} from "../DesktopBridgeComposition";

describe("desktop preload bridge composition", () => {
  it("keeps auth bootstrap and deferred feature namespaces explicitly separated", () => {
    const authBootstrapSurface = Object.freeze({
      bootstrap: Object.freeze({ environment: { isPackaged: false } }),
      storage: Object.freeze({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }),
      runtime: Object.freeze({
        isDeferredFeatureApiReady: () => false,
        getPostLoginRuntimeStatus: () => ({
          host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
          state: "pre-login",
          capabilityPhase: "pre-login",
          unavailableReason: "pre-login",
          updatedAt: "2026-04-11T00:00:00.000Z",
          transport: {
            phase: DesktopControlPlaneTransportPhases.available,
            updatedAt: "2026-04-11T00:00:00.000Z",
          },
        }),
        startPostLoginWarmup: async () => undefined,
      }),
    });

    const deferredFeatureSurface = createDeferredFeatureSurface({
      workflows: Object.freeze({}) as never,
      executionRuns: Object.freeze({}) as never,
      workflowRunSummaries: Object.freeze({}) as never,
      modelFiles: Object.freeze({}) as never,
      canonicalAssets: Object.freeze({}) as never,
      studioShell: Object.freeze({}) as never,
      registry: Object.freeze({}) as never,
      agents: Object.freeze({}) as never,
    });

    const bridge = createDesktopBridge({
      authBootstrapSurface,
      deferredFeatureSurface,
    });

    expect(bridge.auth.bootstrap).toBe(authBootstrapSurface.bootstrap);
    expect(bridge.features.workflows).toBe(deferredFeatureSurface.workflows);
    expect(bridge.storage).toBe(authBootstrapSurface.storage);
    expect(bridge.registry).toBe(deferredFeatureSurface.registry);
  });
});
