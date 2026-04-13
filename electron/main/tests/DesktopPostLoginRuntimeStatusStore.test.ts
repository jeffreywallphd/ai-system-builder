import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginActivationStageIds,
  DesktopPostLoginRuntimeUnavailableReasons,
  DesktopPostLoginWarmupTriggerSources,
} from "../../shared/DesktopContracts";
import { createDesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";

function createTickClock() {
  let tick = 0;
  return () => `2026-04-11T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function findStage(
  stages: ReadonlyArray<{ readonly stageId: string }>,
  stageId: string,
): { readonly stageId: string } {
  const match = stages.find((stage) => stage.stageId === stageId);
  if (!match) {
    throw new Error(`Expected activation stage '${stageId}' to exist.`);
  }
  return match;
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
      transport: {
        phase: DesktopControlPlaneTransportPhases.unavailable,
      },
    });
    const initialStages = store.getStatus().activationStages ?? [];
    expect(initialStages).toHaveLength(5);
    expect(findStage(initialStages, DesktopPostLoginActivationStageIds.pythonRuntimeResolution)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
      state: "pending",
      blockingReadiness: true,
      detail: "Python runtime resolution has not started.",
    });
    expect(findStage(initialStages, DesktopPostLoginActivationStageIds.serviceSupervisorStartup)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
      state: "pending",
      blockingReadiness: true,
      detail: "Service supervisor startup has not started.",
    });
    expect(findStage(initialStages, DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
      state: "pending",
      blockingReadiness: true,
      detail: "Deferred feature runtime composition has not started.",
    });
    expect(findStage(initialStages, DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
      state: "pending",
      blockingReadiness: true,
      detail: "Deferred feature provider setup has not started.",
    });
    expect(findStage(initialStages, DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
      state: "pending",
      blockingReadiness: true,
      detail: "Deferred feature IPC registration has not started.",
    });

    store.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
    expect(store.getStatus()).toMatchObject({
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.shuttingDown,
    });
    const unavailableStages = store.getStatus().activationStages ?? [];
    expect(findStage(unavailableStages, DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition)).toMatchObject({
      state: "pending",
      blockingReadiness: true,
      detail: "Deferred feature runtime composition has not started.",
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
    });
    const warmingStages = store.getStatus().activationStages ?? [];
    expect(findStage(warmingStages, DesktopPostLoginActivationStageIds.pythonRuntimeResolution)).toMatchObject({
      state: "running",
      blockingReadiness: true,
      detail: "Resolving desktop Python runtime.",
    });
    expect(findStage(warmingStages, DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration)).toMatchObject({
      state: "pending",
      blockingReadiness: true,
      detail: "Deferred feature IPC registration has not started.",
    });

    store.markPythonRuntimeResolutionReady({ detail: "mode=development-local, available=true" });
    store.markServiceSupervisorStartupRunning();
    store.markServiceSupervisorStartupReady({
      baseUrl: "http://127.0.0.1:8790",
      runtimeBaseUrl: "http://127.0.0.1:8100",
    });
    store.markDeferredFeatureRuntimeCompositionRunning();
    store.markDeferredFeatureRuntimeCompositionReady({ detail: "Deferred runtime composed." });
    store.markDeferredFeatureProviderSetupRunning();
    store.markDeferredFeatureProviderSetupReady({ detail: "Providers configured." });
    store.markDeferredFeatureIpcRegistrationRunning();
    store.markDeferredFeatureIpcRegistrationReady({ detail: "IPC domains registered." });
    store.markReady();
    expect(store.getStatus()).toMatchObject({
      state: "ready",
      capabilityPhase: "ready",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
    });
    const readyStages = store.getStatus().activationStages ?? [];
    expect(findStage(readyStages, DesktopPostLoginActivationStageIds.pythonRuntimeResolution)).toMatchObject({
      state: "ready",
      blockingReadiness: false,
      detail: "mode=development-local, available=true",
    });
    expect(findStage(readyStages, DesktopPostLoginActivationStageIds.serviceSupervisorStartup)).toMatchObject({
      state: "ready",
      blockingReadiness: false,
      detail: "baseUrl=http://127.0.0.1:8790, runtimeBaseUrl=http://127.0.0.1:8100",
    });
    expect(findStage(readyStages, DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition)).toMatchObject({
      state: "ready",
      blockingReadiness: false,
      detail: "Deferred runtime composed.",
    });
    expect(findStage(readyStages, DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup)).toMatchObject({
      state: "ready",
      blockingReadiness: false,
      detail: "Providers configured.",
    });
    expect(findStage(readyStages, DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration)).toMatchObject({
      state: "ready",
      blockingReadiness: false,
      detail: "IPC domains registered.",
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
      failure: {
        message: "boom",
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
    });
    const stages = store.getStatus().activationStages ?? [];
    expect(findStage(stages, DesktopPostLoginActivationStageIds.pythonRuntimeResolution)).toMatchObject({
      state: "blocked",
      blockingReadiness: true,
      detail: "Desktop Python runtime resolution failed.",
      errorMessage: "python-runtime-missing",
    });
    expect(findStage(stages, DesktopPostLoginActivationStageIds.serviceSupervisorStartup)).toMatchObject({
      state: "pending",
      blockingReadiness: true,
      detail: "Service supervisor startup has not started.",
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
    });
    const stages = store.getStatus().activationStages ?? [];
    expect(findStage(stages, DesktopPostLoginActivationStageIds.pythonRuntimeResolution)).toMatchObject({
      state: "pending",
      blockingReadiness: true,
      detail: "Python runtime resolution has not started.",
    });
    expect(findStage(stages, DesktopPostLoginActivationStageIds.serviceSupervisorStartup)).toMatchObject({
      state: "blocked",
      blockingReadiness: true,
      detail: "Desktop service supervisor startup failed.",
      errorMessage: "supervisor-entrypoint-missing",
    });
  });

  it("tracks deferred runtime registration stages and keeps capability warming until IPC registration is ready", () => {
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: createTickClock(),
    });
    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T12:02:00.000Z",
    });
    store.markDeferredFeatureRuntimeCompositionRunning();
    store.markDeferredFeatureRuntimeCompositionReady({ detail: "runtime-composed" });
    store.markDeferredFeatureProviderSetupRunning();
    store.markDeferredFeatureProviderSetupReady({ detail: "providers-ready" });

    const beforeIpcReady = store.getStatus();
    expect(beforeIpcReady.capabilityPhase).toBe("warming");
    expect(findStage(beforeIpcReady.activationStages ?? [], DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
      state: "pending",
      blockingReadiness: true,
    });

    store.markDeferredFeatureIpcRegistrationRunning();
    store.markDeferredFeatureIpcRegistrationReady({ detail: "ipc-ready" });
    store.markReady();

    const ready = store.getStatus();
    expect(ready.capabilityPhase).toBe("ready");
    expect(findStage(ready.activationStages ?? [], DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration)).toMatchObject({
      stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
      state: "ready",
      blockingReadiness: false,
      detail: "ipc-ready",
    });
  });
});
