import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
} from "../../../../electron/shared/DesktopContracts";
import {
  DesktopPostLoginWarmupTriggerSources,
  requestDesktopPostLoginWarmup,
  resetDesktopPostLoginWarmupStateForTests,
} from "../DesktopPostLoginWarmup";

describe("requestDesktopPostLoginWarmup", () => {
  afterEach(() => {
    resetDesktopPostLoginWarmupStateForTests();
    delete (globalThis as { window?: Window }).window;
  });

  it("returns without side effects when desktop runtime bridge is unavailable", async () => {
    (globalThis as { window: Window }).window = {} as Window;
    await expect(
      requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRestore),
    ).resolves.toBeUndefined();
  });

  it("coalesces concurrent warmup calls and does not re-run after completion", async () => {
    let resolver: (() => void) | undefined;
    let invocations = 0;
    const startPostLoginWarmup = mock((_request: unknown) => {
      invocations += 1;
      return new Promise<void>((resolve) => {
        resolver = resolve;
      });
    });
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        runtime: {
          isDeferredFeatureApiReady: () => false,
          startPostLoginWarmup,
        },
      },
    } as unknown as Window;

    const first = requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.explicitLogin);
    const second = requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRestore);
    resolver?.();
    await Promise.all([first, second]);

    await requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRefresh);
    expect(invocations).toBe(1);
  });

  it("uses auth-scoped runtime bridge when available", async () => {
    const activateCapabilities = mock((_request: unknown) => Promise.resolve());
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            isCapabilityReady: () => false,
            getLifecycleStatus: () => {
              const updatedAt = new Date().toISOString();
              return {
                host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
                state: "pre-login",
                capabilityPhase: "pre-login",
                unavailableReason: "pre-login",
                updatedAt,
                transport: {
                  phase: DesktopControlPlaneTransportPhases.available,
                  updatedAt,
                },
              };
            },
            activateCapabilities,
            isDeferredFeatureApiReady: () => false,
            getPostLoginRuntimeStatus: () => {
              throw new Error("legacy lifecycle getter should not be used when official getter is present");
            },
            startPostLoginWarmup: () => {
              throw new Error("legacy warmup trigger should not be used when official trigger is present");
            },
          },
        },
      },
    } as unknown as Window;

    await requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.explicitLogin);
    expect(activateCapabilities).toHaveBeenCalledTimes(1);
  });
});
