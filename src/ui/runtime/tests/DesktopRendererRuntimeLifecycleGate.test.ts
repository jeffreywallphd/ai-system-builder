import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  DesktopPostLoginRuntimeStates,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../electron/shared/DesktopContracts";
import { resetDesktopPostLoginWarmupStateForTests } from "../DesktopPostLoginWarmup";
import {
  DesktopRendererRuntimeLifecycleUnavailableCode,
  resolveDesktopRendererRuntimeLifecycleGate,
} from "../DesktopRendererRuntimeLifecycleGate";

function createRuntimeStatus(
  state: DesktopPostLoginRuntimeStatus["state"],
): DesktopPostLoginRuntimeStatus {
  const updatedAt = "2026-04-13T10:00:00.000Z";
  return Object.freeze({
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: state,
    unavailableReason: state === DesktopPostLoginRuntimeStates.ready ? undefined : "pre-login",
    updatedAt,
    transport: Object.freeze({
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    }),
  });
}

describe("DesktopRendererRuntimeLifecycleGate", () => {
  afterEach(() => {
    resetDesktopPostLoginWarmupStateForTests();
    delete (globalThis as { window?: Window }).window;
  });

  it("allows calls when no desktop runtime bridge exists", () => {
    const gate = resolveDesktopRendererRuntimeLifecycleGate({
      apiPath: "runtime.run.start",
    });
    expect(gate.ok).toBeTrue();
  });

  it("blocks calls and emits canonical unavailable code when runtime lifecycle is not ready", () => {
    const activateCapabilities = mock(async () => undefined);
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            getLifecycleStatus: () => createRuntimeStatus(DesktopPostLoginRuntimeStates.warming),
            isCapabilityReady: () => false,
            activateCapabilities,
          },
        },
      },
    } as unknown as Window;

    const gate = resolveDesktopRendererRuntimeLifecycleGate({
      apiPath: "runtime.run.start",
    });

    expect(gate.ok).toBeFalse();
    if (!gate.ok) {
      expect(gate.error.code).toBe(DesktopRendererRuntimeLifecycleUnavailableCode);
      expect(gate.error.message).toContain("Requested API: runtime.run.start");
    }
  });

  it("allows calls when runtime lifecycle is ready", () => {
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          runtime: {
            getLifecycleStatus: () => createRuntimeStatus(DesktopPostLoginRuntimeStates.ready),
            isCapabilityReady: () => true,
            activateCapabilities: async () => undefined,
          },
        },
      },
    } as unknown as Window;

    const gate = resolveDesktopRendererRuntimeLifecycleGate({
      apiPath: "runtime.queue.list",
    });
    expect(gate.ok).toBeTrue();
  });
});
