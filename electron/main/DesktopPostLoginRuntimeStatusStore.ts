import type {
  DesktopPostLoginRuntimeStatus,
  DesktopPostLoginRuntimeUnavailableReason,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import {
  DesktopControlPlaneHostIdentities,
  DesktopControlPlaneTransportPhases,
  resolveDesktopControlPlaneRuntimeActivationState,
  transitionDesktopControlPlaneCapabilityPhase,
  transitionDesktopControlPlaneTransportPhase,
  DesktopPostLoginRuntimeActivationModes,
  DesktopPostLoginRuntimeUnavailableReasons,
} from "../shared/DesktopContracts";

type PostLoginRuntimeStatusClock = {
  readonly nowIsoString: () => string;
};

export type DesktopPostLoginRuntimeStatusStore = {
  readonly getStatus: () => DesktopPostLoginRuntimeStatus;
  readonly markTransportBinding: (metadata?: { readonly boundAddress?: string; readonly boundPort?: number; readonly reason?: string }) => void;
  readonly markTransportAvailable: (metadata?: { readonly boundAddress?: string; readonly boundPort?: number; readonly reason?: string }) => void;
  readonly markTransportUnavailable: (reason: string) => void;
  readonly markTransportFailed: (error: unknown, metadata?: { readonly boundAddress?: string; readonly boundPort?: number }) => void;
  readonly markUnavailable: (reason: DesktopPostLoginRuntimeUnavailableReason) => void;
  readonly markWarming: (request: DesktopPostLoginWarmupRequest) => void;
  readonly markReady: () => void;
  readonly markFailed: (request: DesktopPostLoginWarmupRequest, error: unknown) => void;
};

function resolveActivationMode(request: DesktopPostLoginWarmupRequest) {
  return request.triggerSource === "feature-demand"
    ? DesktopPostLoginRuntimeActivationModes.lazyFeatureDemand
    : DesktopPostLoginRuntimeActivationModes.authSuccessWarmup;
}

export function createDesktopPostLoginRuntimeStatusStore(
  clock: PostLoginRuntimeStatusClock = { nowIsoString: () => new Date().toISOString() },
): DesktopPostLoginRuntimeStatusStore {
  let capabilityPhase: DesktopPostLoginRuntimeStatus["capabilityPhase"] = "pre-login";
  let transport = Object.freeze({
    phase: DesktopControlPlaneTransportPhases.unavailable,
    updatedAt: clock.nowIsoString(),
    boundAddress: undefined as string | undefined,
    boundPort: undefined as number | undefined,
    failureMessage: undefined as string | undefined,
  });

  const composeStatus = (overrides?: Partial<Omit<DesktopPostLoginRuntimeStatus, "host" | "state" | "capabilityPhase" | "transport">>): DesktopPostLoginRuntimeStatus => {
    const updatedAt = overrides?.updatedAt ?? clock.nowIsoString();
    return Object.freeze({
      host: DesktopControlPlaneHostIdentities.desktopSessionControlPlane,
      state: resolveDesktopControlPlaneRuntimeActivationState(capabilityPhase),
      capabilityPhase,
      updatedAt,
      activationMode: overrides?.activationMode,
      triggerSource: overrides?.triggerSource,
      requestedAt: overrides?.requestedAt,
      unavailableReason: overrides?.unavailableReason,
      failure: overrides?.failure,
      transport,
    });
  };
  let status: DesktopPostLoginRuntimeStatus = composeStatus({
    unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
  });

  const applyCapabilityTransition = (
    to: DesktopPostLoginRuntimeStatus["capabilityPhase"],
    reason: string,
    overrides?: Partial<Omit<DesktopPostLoginRuntimeStatus, "host" | "state" | "capabilityPhase" | "transport">>,
  ): void => {
    if (to !== capabilityPhase) {
      transitionDesktopControlPlaneCapabilityPhase({
        hostId: status.host.hostId,
        from: capabilityPhase,
        to,
        reason,
      });
    }
    capabilityPhase = to;
    status = composeStatus(overrides);
  };

  return Object.freeze({
    getStatus: () => status,
    markTransportBinding(metadata) {
      if (transport.phase !== DesktopControlPlaneTransportPhases.binding) {
        transitionDesktopControlPlaneTransportPhase({
          hostId: status.host.hostId,
          from: transport.phase,
          to: DesktopControlPlaneTransportPhases.binding,
          reason: metadata?.reason ?? "transport-binding",
        });
      }
      transport = Object.freeze({
        phase: DesktopControlPlaneTransportPhases.binding,
        updatedAt: clock.nowIsoString(),
        boundAddress: metadata?.boundAddress ?? transport.boundAddress,
        boundPort: metadata?.boundPort ?? transport.boundPort,
      });
      status = composeStatus({
        activationMode: status.activationMode,
        triggerSource: status.triggerSource,
        requestedAt: status.requestedAt,
        unavailableReason: status.unavailableReason,
        failure: status.failure,
      });
    },
    markTransportAvailable(metadata) {
      if (transport.phase !== DesktopControlPlaneTransportPhases.available) {
        transitionDesktopControlPlaneTransportPhase({
          hostId: status.host.hostId,
          from: transport.phase,
          to: DesktopControlPlaneTransportPhases.available,
          reason: metadata?.reason ?? "transport-available",
        });
      }
      transport = Object.freeze({
        phase: DesktopControlPlaneTransportPhases.available,
        updatedAt: clock.nowIsoString(),
        boundAddress: metadata?.boundAddress ?? transport.boundAddress,
        boundPort: metadata?.boundPort ?? transport.boundPort,
      });
      status = composeStatus({
        activationMode: status.activationMode,
        triggerSource: status.triggerSource,
        requestedAt: status.requestedAt,
        unavailableReason: status.unavailableReason,
        failure: status.failure,
      });
    },
    markTransportUnavailable(reason) {
      if (transport.phase !== DesktopControlPlaneTransportPhases.unavailable) {
        transitionDesktopControlPlaneTransportPhase({
          hostId: status.host.hostId,
          from: transport.phase,
          to: DesktopControlPlaneTransportPhases.unavailable,
          reason,
        });
      }
      transport = Object.freeze({
        phase: DesktopControlPlaneTransportPhases.unavailable,
        updatedAt: clock.nowIsoString(),
      });
      status = composeStatus({
        activationMode: status.activationMode,
        triggerSource: status.triggerSource,
        requestedAt: status.requestedAt,
        unavailableReason: status.unavailableReason,
        failure: status.failure,
      });
    },
    markTransportFailed(error, metadata) {
      const message = error instanceof Error ? error.message : "Control-plane transport failed.";
      transitionDesktopControlPlaneTransportPhase({
        hostId: status.host.hostId,
        from: transport.phase,
        to: DesktopControlPlaneTransportPhases.failed,
        reason: message,
      });
      transport = Object.freeze({
        phase: DesktopControlPlaneTransportPhases.failed,
        updatedAt: clock.nowIsoString(),
        boundAddress: metadata?.boundAddress ?? transport.boundAddress,
        boundPort: metadata?.boundPort ?? transport.boundPort,
        failureMessage: message,
      });
      status = composeStatus({
        activationMode: status.activationMode,
        triggerSource: status.triggerSource,
        requestedAt: status.requestedAt,
        unavailableReason: status.unavailableReason,
        failure: status.failure,
      });
    },
    markUnavailable(reason) {
      applyCapabilityTransition("pre-login", "runtime-unavailable", {
        unavailableReason: reason,
      });
    },
    markWarming(request) {
      applyCapabilityTransition("warming", "runtime-warming", {
        activationMode: resolveActivationMode(request),
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
      });
    },
    markReady() {
      applyCapabilityTransition("ready", "runtime-ready", {
        activationMode: status.activationMode,
        triggerSource: status.triggerSource,
        requestedAt: status.requestedAt,
        failure: undefined,
      });
    },
    markFailed(request, error) {
      const message = error instanceof Error ? error.message : "Post-login runtime warmup failed.";
      applyCapabilityTransition("failed", "runtime-failed", {
        activationMode: resolveActivationMode(request),
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
        failure: Object.freeze({
          message,
          failedAt: clock.nowIsoString(),
          retryable: true,
        }),
      });
    },
  });
}
