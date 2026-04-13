import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  type DesktopPostLoginRuntimeStatus,
} from "../../../../electron/shared/DesktopContracts";
import {
  buildDesktopRuntimeDiagnosticsSnapshot,
  collectRecentTransitionTimestamps,
  resolveDesktopRuntimeBlockingDependencyCategory,
} from "../DesktopRuntimeDiagnosticsModel";

function createStatus(overrides: Partial<DesktopPostLoginRuntimeStatus>): DesktopPostLoginRuntimeStatus {
  const updatedAt = overrides.updatedAt ?? "2026-04-12T10:00:00.000Z";
  const state = overrides.state ?? "warming";
  return {
    host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
    state,
    capabilityPhase: overrides.capabilityPhase ?? state,
    unavailableReason: overrides.unavailableReason,
    updatedAt,
    transport: {
      phase: DesktopControlPlaneTransportPhases.available,
      updatedAt,
    },
    ...overrides,
  } as const;
}

describe("DesktopRuntimeDiagnosticsModel", () => {
  it("maps pre-login lifecycle to authentication dependency category", () => {
    const status = createStatus({
      state: "pre-login",
      capabilityPhase: "pre-login",
      unavailableReason: "pre-login",
    });
    expect(resolveDesktopRuntimeBlockingDependencyCategory(status)).toBe("authentication");
  });

  it("maps warming lifecycle to capability activation dependency category", () => {
    const status = createStatus({
      state: "warming",
      capabilityPhase: "warming",
    });
    expect(resolveDesktopRuntimeBlockingDependencyCategory(status)).toBe("capability-activation");
  });

  it("maps failed supervisor stage to runtime supervisor dependency category", () => {
    const status = createStatus({
      state: "failed",
      capabilityPhase: "failed",
      activationStages: [
        {
          stageId: "service-supervisor-startup",
          state: "blocked",
          updatedAt: "2026-04-12T10:00:05.000Z",
          blockingReadiness: true,
          errorMessage: "runtime supervisor failed to start",
        },
      ],
    });
    expect(resolveDesktopRuntimeBlockingDependencyCategory(status)).toBe("runtime-supervisor");
  });

  it("maps transport binding failures to control-plane transport dependency category", () => {
    const status = createStatus({
      state: "warming",
      capabilityPhase: "warming",
      transport: {
        phase: "binding",
        updatedAt: "2026-04-12T10:00:03.000Z",
      },
    });
    expect(resolveDesktopRuntimeBlockingDependencyCategory(status)).toBe("control-plane-transport");
  });

  it("collects recent transition timestamps in descending order", () => {
    const status = createStatus({
      state: "failed",
      capabilityPhase: "failed",
      requestedAt: "2026-04-12T09:59:00.000Z",
      updatedAt: "2026-04-12T10:00:04.000Z",
      transport: {
        phase: "available",
        updatedAt: "2026-04-12T10:00:03.000Z",
      },
      failure: {
        message: "activation failed",
        failedAt: "2026-04-12T10:00:05.000Z",
        retryable: true,
      },
      activationStages: [
        {
          stageId: "deferred-feature-provider-setup",
          state: "blocked",
          updatedAt: "2026-04-12T10:00:06.000Z",
          blockingReadiness: true,
          detail: "Provider setup blocked",
        },
      ],
    });

    const transitions = collectRecentTransitionTimestamps(status);
    expect(transitions.length).toBeGreaterThan(3);
    expect(transitions[0]?.occurredAt).toBe("2026-04-12T10:00:06.000Z");
    expect(transitions[1]?.occurredAt).toBe("2026-04-12T10:00:05.000Z");
  });

  it("builds a diagnostics snapshot with blocking stage details", () => {
    const status = createStatus({
      state: "warming",
      capabilityPhase: "warming",
      activationStages: [
        {
          stageId: "python-runtime-resolution",
          state: "running",
          updatedAt: "2026-04-12T10:00:08.000Z",
          blockingReadiness: true,
          detail: "Resolving bundled Python",
        },
      ],
    });
    const snapshot = buildDesktopRuntimeDiagnosticsSnapshot(status);

    expect(snapshot?.lifecycleState).toBe("warming");
    expect(snapshot?.blockingDependencyCategory).toBe("capability-activation");
    expect(snapshot?.blockingActivationStageId).toBe("python-runtime-resolution");
    expect(snapshot?.blockingActivationStageState).toBe("running");
    expect(snapshot?.blockingActivationStageDetail).toContain("Resolving bundled Python");
  });
});
