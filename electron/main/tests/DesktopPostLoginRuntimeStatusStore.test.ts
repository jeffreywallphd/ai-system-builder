import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeUnavailableReasons,
  DesktopPostLoginWarmupTriggerSources,
} from "../../shared/DesktopContracts";
import { createDesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";

describe("createDesktopPostLoginRuntimeStatusStore", () => {
  it("tracks pre-login -> warming -> ready -> failed capability transitions with explicit transport status", () => {
    let tick = 0;
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: () => `2026-04-11T00:00:0${tick++}.000Z`,
    });

    expect(store.getStatus()).toMatchObject({
      host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
      updatedAt: "2026-04-11T00:00:00.000Z",
      transport: {
        phase: DesktopControlPlaneTransportPhases.unavailable,
      },
    });

    store.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
    expect(store.getStatus()).toMatchObject({
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.shuttingDown,
      updatedAt: "2026-04-11T00:00:01.000Z",
    });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
    });
    expect(store.getStatus()).toMatchObject({
      state: "warming",
      capabilityPhase: "warming",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:02.000Z",
    });

    store.markReady();
    expect(store.getStatus()).toMatchObject({
      state: "ready",
      capabilityPhase: "ready",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:03.000Z",
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
      updatedAt: "2026-04-11T00:00:04.000Z",
      failure: {
        message: "boom",
        failedAt: "2026-04-11T00:00:05.000Z",
        retryable: true,
      },
    });
  });

  it("tracks transport lifecycle independently of capability readiness", () => {
    let tick = 0;
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: () => `2026-04-11T00:00:0${tick++}.000Z`,
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
    let tick = 0;
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: () => `2026-04-11T00:00:0${tick++}.000Z`,
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
});
