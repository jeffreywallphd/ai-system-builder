import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeUnavailableReasons,
  DesktopPostLoginWarmupTriggerSources,
} from "../../shared/DesktopContracts";
import { createDesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";

function createTickClock() {
  let tick = 0;
  return () => `2026-04-11T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

describe("createDesktopPostLoginRuntimeStatusStore", () => {
  it("tracks pre-login -> warming -> ready -> failed capability transitions with explicit transport status", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });

    expect(store.getStatus()).toMatchObject({
      host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
      updatedAt: "2026-04-11T00:00:02.000Z",
      transport: {
        phase: DesktopControlPlaneTransportPhases.unavailable,
      },
    });
    expect(store.getStatus().activationStages).toEqual([
      {
        stageId: "python-runtime-resolution",
        state: "pending",
        blockingReadiness: true,
        updatedAt: "2026-04-11T00:00:00.000Z",
        detail: "Python runtime resolution has not started.",
      },
      {
        stageId: "service-supervisor-startup",
        state: "pending",
        blockingReadiness: true,
        updatedAt: "2026-04-11T00:00:01.000Z",
        detail: "Service supervisor startup has not started.",
      },
    ]);

    store.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
    expect(store.getStatus()).toMatchObject({
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.shuttingDown,
      updatedAt: "2026-04-11T00:00:05.000Z",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "pending",
          blockingReadiness: true,
          detail: "Python runtime resolution has not started.",
        },
        {
          stageId: "service-supervisor-startup",
          state: "pending",
          blockingReadiness: true,
          detail: "Service supervisor startup has not started.",
        },
      ],
    });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
    });
    store.markPythonRuntimeResolutionRunning();
    expect(store.getStatus()).toMatchObject({
      state: "warming",
      capabilityPhase: "warming",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:08.000Z",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "running",
          blockingReadiness: true,
          detail: "Resolving desktop Python runtime.",
        },
        {
          stageId: "service-supervisor-startup",
          state: "pending",
          blockingReadiness: true,
          detail: "Service supervisor startup has not started.",
        },
      ],
    });

    store.markPythonRuntimeResolutionReady({ detail: "mode=development-local, available=true" });
    store.markServiceSupervisorStartupRunning();
    store.markServiceSupervisorStartupReady({
      baseUrl: "http://127.0.0.1:8790",
      runtimeBaseUrl: "http://127.0.0.1:8100",
    });
    store.markReady();
    expect(store.getStatus()).toMatchObject({
      state: "ready",
      capabilityPhase: "ready",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:11.000Z",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "ready",
          blockingReadiness: false,
          detail: "mode=development-local, available=true",
        },
        {
          stageId: "service-supervisor-startup",
          state: "ready",
          blockingReadiness: false,
          detail: "baseUrl=http://127.0.0.1:8790, runtimeBaseUrl=http://127.0.0.1:8100",
        },
      ],
    });

    store.markFailed(
      {
        triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
        requestedAt: "2026-04-11T10:01:00.000Z",
      },
      new Error("boom"),
    );
    expect(store.getStatus()).toMatchObject({
      state: "failed",
      capabilityPhase: "failed",
      activationMode: "auth-success-warmup",
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      requestedAt: "2026-04-11T10:01:00.000Z",
      updatedAt: "2026-04-11T00:00:12.000Z",
      failure: {
        message: "boom",
        failedAt: "2026-04-11T00:00:13.000Z",
        retryable: true,
      },
    });
  });

  it("tracks transport lifecycle independently of capability readiness", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });
    store.markTransportBinding({ boundPort: 4120, reason: "bind-start" });
    store.markTransportAvailable({ boundAddress: "127.0.0.1:4120", boundPort: 4120, reason: "bind-ready" });

    expect(store.getStatus()).toMatchObject({
      state: "pre-login",
      capabilityPhase: "pre-login",
      transport: {
        phase: DesktopControlPlaneTransportPhases.available,
        boundAddress: "127.0.0.1:4120",
        boundPort: 4120,
      },
    });
  });

  it("keeps the same bound transport identity through pre-login, warming, ready, and failed transitions", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });

    store.markTransportBinding({ boundAddress: "127.0.0.1:4220", boundPort: 4220, reason: "bind-start" });
    store.markTransportAvailable({ boundAddress: "127.0.0.1:4220", boundPort: 4220, reason: "bind-ready" });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      requestedAt: "2026-04-11T10:05:00.000Z",
    });
    const warming = store.getStatus();
    expect(warming.capabilityPhase).toBe("warming");
    expect(warming.transport).toMatchObject({
      phase: DesktopControlPlaneTransportPhases.available,
      boundAddress: "127.0.0.1:4220",
      boundPort: 4220,
    });

    store.markReady();
    const ready = store.getStatus();
    expect(ready.capabilityPhase).toBe("ready");
    expect(ready.transport).toMatchObject({
      phase: DesktopControlPlaneTransportPhases.available,
      boundAddress: "127.0.0.1:4220",
      boundPort: 4220,
    });

    store.markFailed(
      {
        triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
        requestedAt: "2026-04-11T10:06:00.000Z",
      },
      new Error("warmup-failed"),
    );
    const failed = store.getStatus();
    expect(failed.capabilityPhase).toBe("failed");
    expect(failed.transport).toMatchObject({
      phase: DesktopControlPlaneTransportPhases.available,
      boundAddress: "127.0.0.1:4220",
      boundPort: 4220,
    });
    expect(failed.host).toEqual(DesktopControlPlaneHostIdentities.desktopSessionControlPlane);
  });

  it("uses the default failure message for unknown errors", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({ nowIsoString: () => "2026-04-11T00:00:00.000Z" });
    store.markFailed({ triggerSource: DesktopPostLoginWarmupTriggerSources.unknown }, "nope");
    expect(store.getStatus()).toMatchObject({
      state: "failed",
      failure: {
        message: "Post-login runtime warmup failed.",
        retryable: true,
      },
    });
  });

  it("marks python runtime resolution as blocked when stage resolution fails", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      requestedAt: "2026-04-11T12:00:00.000Z",
    });
    store.markPythonRuntimeResolutionRunning();
    store.markPythonRuntimeResolutionBlocked(new Error("python-runtime-missing"));

    expect(store.getStatus()).toMatchObject({
      capabilityPhase: "warming",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "blocked",
          blockingReadiness: true,
          detail: "Desktop Python runtime resolution failed.",
          errorMessage: "python-runtime-missing",
        },
        {
          stageId: "service-supervisor-startup",
          state: "pending",
          blockingReadiness: true,
          detail: "Service supervisor startup has not started.",
        },
      ],
    });
  });

  it("marks service supervisor startup as blocked when stage startup fails", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      requestedAt: "2026-04-11T12:01:00.000Z",
    });
    store.markServiceSupervisorStartupRunning();
    store.markServiceSupervisorStartupBlocked(new Error("supervisor-entrypoint-missing"));

    expect(store.getStatus()).toMatchObject({
      capabilityPhase: "warming",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "pending",
          blockingReadiness: true,
          detail: "Python runtime resolution has not started.",
        },
        {
          stageId: "service-supervisor-startup",
          state: "blocked",
          blockingReadiness: true,
          detail: "Desktop service supervisor startup failed.",
          errorMessage: "supervisor-entrypoint-missing",
        },
      ],
    });
  });
});
