import { describe, expect, it } from "bun:test";
import {
  DesktopPostLoginRuntimeUnavailableReasons,
  DesktopPostLoginWarmupTriggerSources,
} from "../../shared/DesktopContracts";
import { createDesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";

describe("createDesktopPostLoginRuntimeStatusStore", () => {
  it("tracks unavailable -> warming -> ready -> failed transitions with existing contract semantics", () => {
    let tick = 0;
    const store = createDesktopPostLoginRuntimeStatusStore({
      nowIsoString: () => `2026-04-11T00:00:0${tick++}.000Z`,
    });

    expect(store.getStatus()).toEqual({
      state: "unavailable",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
      updatedAt: "2026-04-11T00:00:00.000Z",
    });

    store.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
    expect(store.getStatus()).toEqual({
      state: "unavailable",
      unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.shuttingDown,
      updatedAt: "2026-04-11T00:00:01.000Z",
    });

    store.markWarming({
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
    });
    expect(store.getStatus()).toEqual({
      state: "warming",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:02.000Z",
    });

    store.markReady();
    expect(store.getStatus()).toEqual({
      state: "ready",
      activationMode: "lazy-feature-demand",
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
      requestedAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T00:00:03.000Z",
      failure: undefined,
    });

    store.markFailed(
      {
        triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
        requestedAt: "2026-04-11T10:01:00.000Z",
      },
      new Error("boom"),
    );
    expect(store.getStatus()).toEqual({
      state: "failed",
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
