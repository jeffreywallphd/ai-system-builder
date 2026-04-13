import { describe, expect, it } from "bun:test";
import {
  DesktopControlPlaneCapabilityPhases,
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneRuntimeContractError,
  DesktopControlPlaneTransportPhases,
  createDesktopControlPlaneRuntimeStatus,
  isDesktopControlPlaneRuntimeReady,
  resolveDesktopControlPlaneRuntimeActivationState,
  transitionDesktopControlPlaneCapabilityPhase,
  transitionDesktopControlPlaneTransportPhase,
} from "../DesktopControlPlaneRuntimeContracts";

describe("DesktopControlPlaneRuntimeContracts", () => {
  it("defines canonical capability phases with explicit pre-login semantics", () => {
    expect(DesktopControlPlaneCapabilityPhases.preLogin).toBe("pre-login");
    expect(DesktopControlPlaneCapabilityPhases.warming).toBe("warming");
    expect(DesktopControlPlaneCapabilityPhases.ready).toBe("ready");
    expect(DesktopControlPlaneCapabilityPhases.failed).toBe("failed");
  });

  it("creates default runtime status with stable host identity and explicit transport state", () => {
    const status = createDesktopControlPlaneRuntimeStatus({
      updatedAt: "2026-04-12T10:00:00.000Z",
    });

    expect(status.host).toEqual(DesktopControlPlaneHostIdentities.desktopSessionControlPlane);
    expect(status.capabilityPhase).toBe(DesktopControlPlaneCapabilityPhases.preLogin);
    expect(status.transport.phase).toBe(DesktopControlPlaneTransportPhases.unavailable);
    expect(isDesktopControlPlaneRuntimeReady(status)).toBeFalse();
  });

  it("derives activation state from capability phase instead of transport availability", () => {
    expect(resolveDesktopControlPlaneRuntimeActivationState(DesktopControlPlaneCapabilityPhases.ready)).toBe("ready");
    const status = createDesktopControlPlaneRuntimeStatus({
      capabilityPhase: DesktopControlPlaneCapabilityPhases.warming,
      transportPhase: DesktopControlPlaneTransportPhases.available,
      updatedAt: "2026-04-12T10:00:00.000Z",
    });
    expect(status.state).toBe("warming");
    expect(isDesktopControlPlaneRuntimeReady(status)).toBeFalse();
  });

  it("enforces lifecycle transitions for capability and transport tracks", () => {
    expect(() => transitionDesktopControlPlaneCapabilityPhase({
      hostId: "host:desktop:session-control-plane",
      from: DesktopControlPlaneCapabilityPhases.preLogin,
      to: DesktopControlPlaneCapabilityPhases.warming,
      reason: "warmup-requested",
    })).not.toThrow();

    expect(() => transitionDesktopControlPlaneTransportPhase({
      hostId: "host:desktop:session-control-plane",
      from: DesktopControlPlaneTransportPhases.unavailable,
      to: DesktopControlPlaneTransportPhases.binding,
      reason: "bootstrap-bind-start",
    })).not.toThrow();

    expect(() => transitionDesktopControlPlaneCapabilityPhase({
      hostId: "host:desktop:session-control-plane",
      from: DesktopControlPlaneCapabilityPhases.preLogin,
      to: DesktopControlPlaneCapabilityPhases.ready,
      reason: "invalid-skip",
    })).toThrow(DesktopControlPlaneRuntimeContractError);
  });
});
