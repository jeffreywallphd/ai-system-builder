import { describe, expect, it } from "bun:test";
import { createDesktopRuntimeDisposalCoordinator } from "../runtime/DesktopRuntimeDisposalCoordinator";
import { createDesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import { createDesktopConnectivityRuntimeController } from "../DesktopConnectivityRuntimeController";

describe("DesktopRuntimeDisposalCoordinator", () => {
  it("disposes runtime resources in the expected shutdown order and resets state", async () => {
    const events: string[] = [];
    let isDisposing = false;
    let postLoginBootstrapPromise: Promise<void> | undefined = Promise.resolve().then(() => {
      events.push("bootstrap-settled");
    });
    const controlPlaneServerRuntime = {
      stop: async () => {
        events.push("control-plane-stop");
      },
    };
    const serviceSupervisor = {
      stop: async () => {
        events.push("service-supervisor-stop");
      },
    };
    const storageDatabase = {
      dispose: () => {
        events.push("storage-dispose");
      },
    };
    let deferredFeatureRuntime: { dispose: () => void } | undefined = {
      dispose: () => {
        events.push("deferred-runtime-dispose");
      },
    };
    let agentRuntimeProvider: { dispose: () => void } | undefined = {
      dispose: () => {
        events.push("agent-provider-dispose");
      },
    };
    let canonicalRegistryRuntimeProvider: { dispose: () => void } | undefined = {
      dispose: () => {
        events.push("registry-provider-dispose");
      },
    };
    let bootstrapContextCleared = false;
    let deferredIpcReset = false;
    let warmupReset = false;
    let authShellCleared = false;
    let deferredFactoryCleared = false;
    const postLoginRuntimeStatusStore = createDesktopPostLoginRuntimeStatusStore({ nowIsoString: () => "2026-01-01T00:00:00.000Z" });
    const connectivityRuntimeController = createDesktopConnectivityRuntimeController({
      createConnectivityStateService: () => ({
        getState: () => ({}),
        setDeliberateOfflineMode: () => ({}),
        startMonitoring: () => {
          events.push("connectivity-start");
        },
        stopMonitoring: () => {
          events.push("connectivity-stop");
        },
      }),
      createConnectivityProbePort: () => ({}),
      lookupToken: () => null,
      nowIsoString: () => "2026-01-01T00:00:00.000Z",
    });
    connectivityRuntimeController.startMonitoring("http://127.0.0.1:8100");

    const coordinator = createDesktopRuntimeDisposalCoordinator({
      getPostLoginBootstrapPromise: () => postLoginBootstrapPromise,
      setPostLoginBootstrapPromise: (promise) => {
        postLoginBootstrapPromise = promise;
      },
      getControlPlaneServerRuntime: () => controlPlaneServerRuntime as never,
      setControlPlaneServerRuntime: () => undefined,
      getServiceSupervisor: () => serviceSupervisor as never,
      setServiceSupervisor: () => undefined,
      getStorageDatabase: () => storageDatabase as never,
      getDeferredFeatureRuntime: () => deferredFeatureRuntime as never,
      setDeferredFeatureRuntime: (runtime) => {
        deferredFeatureRuntime = runtime as never;
      },
      getAgentRuntimeProvider: () => agentRuntimeProvider as never,
      setAgentRuntimeProvider: (provider) => {
        agentRuntimeProvider = provider as never;
      },
      getCanonicalRegistryRuntimeProvider: () => canonicalRegistryRuntimeProvider as never,
      setCanonicalRegistryRuntimeProvider: (provider) => {
        canonicalRegistryRuntimeProvider = provider as never;
      },
      clearBootstrapContext: () => {
        bootstrapContextCleared = true;
      },
      resetDeferredFeatureIpcReadiness: () => {
        deferredIpcReset = true;
      },
      resetWarmupStarted: () => {
        warmupReset = true;
      },
      clearAuthShellBootstrapResult: () => {
        authShellCleared = true;
      },
      clearDeferredRuntimeFactoryCache: () => {
        deferredFactoryCleared = true;
      },
      connectivityRuntimeController,
      postLoginRuntimeStatusStore,
      setIsDisposing: (value) => {
        isDisposing = value;
      },
    });

    await coordinator.disposeDesktopRuntimeResources();

    expect(events).toEqual([
      "connectivity-start",
      "bootstrap-settled",
      "connectivity-stop",
      "control-plane-stop",
      "service-supervisor-stop",
      "storage-dispose",
      "deferred-runtime-dispose",
      "agent-provider-dispose",
      "registry-provider-dispose",
    ]);
    expect(postLoginBootstrapPromise).toBeUndefined();
    expect(deferredFeatureRuntime).toBeUndefined();
    expect(agentRuntimeProvider).toBeUndefined();
    expect(canonicalRegistryRuntimeProvider).toBeUndefined();
    expect(bootstrapContextCleared).toBeTrue();
    expect(deferredIpcReset).toBeTrue();
    expect(warmupReset).toBeTrue();
    expect(authShellCleared).toBeTrue();
    expect(deferredFactoryCleared).toBeTrue();
    expect(postLoginRuntimeStatusStore.getStatus().unavailableReason).toBe("pre-login");
    expect(isDisposing).toBeFalse();
  });
});
