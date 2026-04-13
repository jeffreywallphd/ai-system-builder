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
    const runtimeStatus = {
      host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
      state: "pre-login" as const,
      capabilityPhase: "pre-login" as const,
      unavailableReason: "pre-login" as const,
      updatedAt: "2026-04-11T00:00:00.000Z",
      transport: {
        phase: DesktopControlPlaneTransportPhases.available,
        updatedAt: "2026-04-11T00:00:00.000Z",
      },
    };
    const authBootstrapSurface = Object.freeze({
      bootstrapContext: Object.freeze({ environment: { isPackaged: false }, runtimeConfig: { controlPlaneBaseUrl: "http://127.0.0.1:8788", controlPlaneCapabilityPhase: "pre-login" } }),
      bootstrap: Object.freeze({ environment: { isPackaged: false } }),
      controlPlane: Object.freeze({
        baseUrl: "http://127.0.0.1:8788",
        capabilityPhase: "pre-login",
      }),
      storage: Object.freeze({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined }),
      runtime: Object.freeze({
        isCapabilityReady: () => false,
        getLifecycleStatus: () => runtimeStatus,
        getTransportStatus: () => runtimeStatus.transport,
        activateCapabilities: async () => undefined,
        isDeferredFeatureApiReady: () => false,
        getPostLoginRuntimeStatus: () => runtimeStatus,
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
    expect(bridge.auth.bootstrapContext).toBe(authBootstrapSurface.bootstrapContext);
    expect(bridge.auth.controlPlane.baseUrl).toBe("http://127.0.0.1:8788");
    expect(bridge.features.workflows).toBe(deferredFeatureSurface.workflows);
    expect(bridge.storage).toBe(authBootstrapSurface.storage);
    expect(bridge.registry).toBe(deferredFeatureSurface.registry);
  });
});
