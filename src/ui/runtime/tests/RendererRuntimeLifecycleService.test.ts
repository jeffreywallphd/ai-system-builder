import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginWarmupTriggerSources,
  type DesktopPostLoginRuntimeStatus,
  type DesktopRuntimeBootstrapBridge,
} from "../../../../electron/shared/DesktopContracts";
import {
  createRendererRuntimeLifecycleService,
  resolveRendererRuntimeRefreshIntervalMs,
  resolveRendererRuntimeRefreshStateKey,
  resolveRendererRuntimeBridge,
  resolveRendererRuntimeReadiness,
  resolveRendererRuntimeStatus,
} from "../RendererRuntimeLifecycleService";

function createStatus(state: DesktopPostLoginRuntimeStatus["state"]): DesktopPostLoginRuntimeStatus {
  const updatedAt = "2026-04-12T09:30:00.000Z";
  return {
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: state,
    unavailableReason: state === "ready" ? undefined : "pre-login",
    updatedAt,
    transport: {
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    },
  };
}

describe("RendererRuntimeLifecycleService", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("prefers auth runtime bridge when available", () => {
    const authRuntime = {} as DesktopRuntimeBootstrapBridge;
    const legacyRuntime = {} as DesktopRuntimeBootstrapBridge;
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: { runtime: authRuntime },
        runtime: legacyRuntime,
      },
    } as unknown as Window;

    expect(resolveRendererRuntimeBridge()).toBe(authRuntime);
  });

  it("resolves lifecycle status from official getter with legacy fallback", () => {
    const warmingStatus = createStatus("warming");
    const readyStatus = createStatus("ready");
    const officialBridge = {
      getLifecycleStatus: () => warmingStatus,
      getPostLoginRuntimeStatus: () => readyStatus,
    } as DesktopRuntimeBootstrapBridge;
    const legacyBridge = {
      getPostLoginRuntimeStatus: () => readyStatus,
    } as DesktopRuntimeBootstrapBridge;

    expect(resolveRendererRuntimeStatus(officialBridge)).toEqual(warmingStatus);
    expect(resolveRendererRuntimeStatus(legacyBridge)).toEqual(readyStatus);
  });

  it("maps lifecycle status to readiness across pre-login, warming, ready, and failed", () => {
    const bridge = {} as DesktopRuntimeBootstrapBridge;
    expect(resolveRendererRuntimeReadiness({ bridge, status: createStatus("pre-login") })).toBeFalse();
    expect(resolveRendererRuntimeReadiness({ bridge, status: createStatus("warming") })).toBeFalse();
    expect(resolveRendererRuntimeReadiness({ bridge, status: createStatus("ready") })).toBeTrue();
    expect(resolveRendererRuntimeReadiness({ bridge, status: createStatus("failed") })).toBeFalse();
  });

  it("falls back to runtime readiness probes when lifecycle status is unavailable", () => {
    const bridge = {
      isCapabilityReady: () => false,
      isDeferredFeatureApiReady: () => true,
    } as DesktopRuntimeBootstrapBridge;
    expect(resolveRendererRuntimeReadiness({ bridge, status: undefined })).toBeFalse();

    const legacyBridge = {
      isDeferredFeatureApiReady: () => true,
    } as DesktopRuntimeBootstrapBridge;
    expect(resolveRendererRuntimeReadiness({ bridge: legacyBridge, status: undefined })).toBeTrue();
    expect(resolveRendererRuntimeReadiness({ bridge: undefined, status: undefined })).toBeTrue();
  });

  it("exposes centralized warmup activation with retry trigger support", async () => {
    const requestWarmup = mock((_triggerSource: string) => Promise.resolve());
    const service = createRendererRuntimeLifecycleService({
      getRuntimeBridge: () => undefined,
      requestWarmup,
    });

    await service.activate();
    await service.activate(DesktopPostLoginWarmupTriggerSources.sessionRestore);

    expect(requestWarmup).toHaveBeenNthCalledWith(1, DesktopPostLoginWarmupTriggerSources.featureDemand);
    expect(requestWarmup).toHaveBeenNthCalledWith(2, DesktopPostLoginWarmupTriggerSources.sessionRestore);
  });

  it("builds refresh-state keys from lifecycle semantics instead of timestamp churn", () => {
    const first = createStatus("warming");
    const second = {
      ...createStatus("warming"),
      updatedAt: "2026-04-12T09:35:00.000Z",
      transport: {
        phase: DesktopControlPlaneTransportPhases.available,
        updatedAt: "2026-04-12T09:35:00.000Z",
      },
    } as DesktopPostLoginRuntimeStatus;

    expect(resolveRendererRuntimeRefreshStateKey(first)).toBe(resolveRendererRuntimeRefreshStateKey(second));
  });

  it("uses lifecycle-aware refresh intervals with bounded warming/failed backoff", () => {
    const warmingEarly = resolveRendererRuntimeRefreshIntervalMs({
      status: createStatus("warming"),
      stableRefreshCount: 0,
      defaultPollingIntervalMs: 900,
    });
    const warmingSteady = resolveRendererRuntimeRefreshIntervalMs({
      status: createStatus("warming"),
      stableRefreshCount: 6,
      defaultPollingIntervalMs: 900,
    });
    const failedEarly = resolveRendererRuntimeRefreshIntervalMs({
      status: createStatus("failed"),
      stableRefreshCount: 0,
      defaultPollingIntervalMs: 900,
    });
    const failedSteady = resolveRendererRuntimeRefreshIntervalMs({
      status: createStatus("failed"),
      stableRefreshCount: 10,
      defaultPollingIntervalMs: 900,
    });
    const ready = resolveRendererRuntimeRefreshIntervalMs({
      status: createStatus("ready"),
      stableRefreshCount: 10,
      defaultPollingIntervalMs: 900,
    });

    expect(warmingEarly).toBe(900);
    expect(warmingSteady).toBeGreaterThan(warmingEarly);
    expect(warmingSteady).toBeLessThanOrEqual(2600);
    expect(failedEarly).toBe(900);
    expect(failedSteady).toBeGreaterThan(failedEarly);
    expect(failedSteady).toBeLessThanOrEqual(7000);
    expect(ready).toBe(2200);
  });
});
