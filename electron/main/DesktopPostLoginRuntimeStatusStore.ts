import type {
  DesktopPostLoginActivationStageStatus,
  DesktopPostLoginRuntimeStatus,
  DesktopPostLoginRuntimeUnavailableReason,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import {
  DesktopControlPlaneActivationStageStates,
  DesktopPostLoginActivationStageIds,
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
  readonly markPythonRuntimeResolutionRunning: () => void;
  readonly markPythonRuntimeResolutionReady: (metadata?: { readonly detail?: string }) => void;
  readonly markPythonRuntimeResolutionBlocked: (error: unknown) => void;
  readonly markServiceSupervisorStartupRunning: () => void;
  readonly markServiceSupervisorStartupReady: (metadata?: { readonly baseUrl: string; readonly runtimeBaseUrl: string }) => void;
  readonly markServiceSupervisorStartupBlocked: (error: unknown) => void;
  readonly markDeferredFeatureRuntimeCompositionRunning: () => void;
  readonly markDeferredFeatureRuntimeCompositionReady: (metadata?: { readonly detail?: string }) => void;
  readonly markDeferredFeatureRuntimeCompositionBlocked: (error: unknown) => void;
  readonly markDeferredFeatureProviderSetupRunning: () => void;
  readonly markDeferredFeatureProviderSetupReady: (metadata?: { readonly detail?: string }) => void;
  readonly markDeferredFeatureProviderSetupBlocked: (error: unknown) => void;
  readonly markDeferredFeatureIpcRegistrationRunning: () => void;
  readonly markDeferredFeatureIpcRegistrationReady: (metadata?: { readonly detail?: string }) => void;
  readonly markDeferredFeatureIpcRegistrationBlocked: (error: unknown) => void;
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
  const createPendingStageStatus = (stageId: string, detail: string): DesktopPostLoginActivationStageStatus => {
    return Object.freeze({
      stageId,
      state: DesktopControlPlaneActivationStageStates.pending,
      updatedAt: clock.nowIsoString(),
      blockingReadiness: true,
      detail,
      errorMessage: undefined,
    });
  };

  const pendingStageDetails = Object.freeze({
    pythonRuntimeResolution: "Python runtime resolution has not started.",
    serviceSupervisorStartup: "Service supervisor startup has not started.",
    deferredFeatureRuntimeComposition: "Deferred feature runtime composition has not started.",
    deferredFeatureProviderSetup: "Deferred feature provider setup has not started.",
    deferredFeatureIpcRegistration: "Deferred feature IPC registration has not started.",
  });

  let capabilityPhase: DesktopPostLoginRuntimeStatus["capabilityPhase"] = "pre-login";
  const stageStatuses = new Map<string, DesktopPostLoginActivationStageStatus>();
  stageStatuses.set(
    DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
    createPendingStageStatus(DesktopPostLoginActivationStageIds.pythonRuntimeResolution, pendingStageDetails.pythonRuntimeResolution),
  );
  stageStatuses.set(
    DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
    createPendingStageStatus(DesktopPostLoginActivationStageIds.serviceSupervisorStartup, pendingStageDetails.serviceSupervisorStartup),
  );
  stageStatuses.set(
    DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
    createPendingStageStatus(
      DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
      pendingStageDetails.deferredFeatureRuntimeComposition,
    ),
  );
  stageStatuses.set(
    DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
    createPendingStageStatus(
      DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
      pendingStageDetails.deferredFeatureProviderSetup,
    ),
  );
  stageStatuses.set(
    DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
    createPendingStageStatus(
      DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
      pendingStageDetails.deferredFeatureIpcRegistration,
    ),
  );
  let transport = Object.freeze({
    phase: DesktopControlPlaneTransportPhases.unavailable,
    updatedAt: clock.nowIsoString(),
    boundAddress: undefined as string | undefined,
    boundPort: undefined as number | undefined,
    failureMessage: undefined as string | undefined,
  });

  const composeStatus = (overrides?: Partial<Omit<DesktopPostLoginRuntimeStatus, "host" | "state" | "capabilityPhase" | "transport" | "activationStages">>): DesktopPostLoginRuntimeStatus => {
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
      activationStages: Object.freeze([...stageStatuses.values()]),
    });
  };
  let status: DesktopPostLoginRuntimeStatus = composeStatus({
    unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
  });

  const applyCapabilityTransition = (
    to: DesktopPostLoginRuntimeStatus["capabilityPhase"],
    reason: string,
    overrides?: Partial<Omit<DesktopPostLoginRuntimeStatus, "host" | "state" | "capabilityPhase" | "transport" | "activationStages">>,
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

  const updateActivationStage = (stageStatus: DesktopPostLoginActivationStageStatus): void => {
    stageStatuses.set(stageStatus.stageId, stageStatus);
    status = composeStatus({
      activationMode: status.activationMode,
      triggerSource: status.triggerSource,
      requestedAt: status.requestedAt,
      unavailableReason: status.unavailableReason,
      failure: status.failure,
    });
  };

  const resetPythonRuntimeResolutionStage = (): void => {
    updateActivationStage(
      createPendingStageStatus(
        DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
        pendingStageDetails.pythonRuntimeResolution,
      ),
    );
  };

  const resetServiceSupervisorStartupStage = (): void => {
    updateActivationStage(
      createPendingStageStatus(
        DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
        pendingStageDetails.serviceSupervisorStartup,
      ),
    );
  };

  const resetDeferredFeatureRuntimeCompositionStage = (): void => {
    updateActivationStage(
      createPendingStageStatus(
        DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
        pendingStageDetails.deferredFeatureRuntimeComposition,
      ),
    );
  };

  const resetDeferredFeatureProviderSetupStage = (): void => {
    updateActivationStage(
      createPendingStageStatus(
        DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
        pendingStageDetails.deferredFeatureProviderSetup,
      ),
    );
  };

  const resetDeferredFeatureIpcRegistrationStage = (): void => {
    updateActivationStage(
      createPendingStageStatus(
        DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
        pendingStageDetails.deferredFeatureIpcRegistration,
      ),
    );
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
    markPythonRuntimeResolutionRunning() {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
        state: DesktopControlPlaneActivationStageStates.running,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Resolving desktop Python runtime.",
      }));
    },
    markPythonRuntimeResolutionReady(metadata) {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
        state: DesktopControlPlaneActivationStageStates.ready,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: false,
        detail: metadata?.detail,
      }));
    },
    markPythonRuntimeResolutionBlocked(error) {
      const message = error instanceof Error ? error.message : "Desktop Python runtime resolution failed.";
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.pythonRuntimeResolution,
        state: DesktopControlPlaneActivationStageStates.blocked,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Desktop Python runtime resolution failed.",
        errorMessage: message,
      }));
    },
    markServiceSupervisorStartupRunning() {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
        state: DesktopControlPlaneActivationStageStates.running,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Starting desktop service supervisor.",
      }));
    },
    markServiceSupervisorStartupReady(metadata) {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
        state: DesktopControlPlaneActivationStageStates.ready,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: false,
        detail: `baseUrl=${metadata?.baseUrl ?? "unknown"}, runtimeBaseUrl=${metadata?.runtimeBaseUrl ?? "unknown"}`,
      }));
    },
    markServiceSupervisorStartupBlocked(error) {
      const message = error instanceof Error ? error.message : "Desktop service supervisor startup failed.";
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.serviceSupervisorStartup,
        state: DesktopControlPlaneActivationStageStates.blocked,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Desktop service supervisor startup failed.",
        errorMessage: message,
      }));
    },
    markDeferredFeatureRuntimeCompositionRunning() {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
        state: DesktopControlPlaneActivationStageStates.running,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Composing deferred feature runtime services.",
      }));
    },
    markDeferredFeatureRuntimeCompositionReady(metadata) {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
        state: DesktopControlPlaneActivationStageStates.ready,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: false,
        detail: metadata?.detail,
      }));
    },
    markDeferredFeatureRuntimeCompositionBlocked(error) {
      const message = error instanceof Error ? error.message : "Deferred feature runtime composition failed.";
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureRuntimeComposition,
        state: DesktopControlPlaneActivationStageStates.blocked,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Deferred feature runtime composition failed.",
        errorMessage: message,
      }));
    },
    markDeferredFeatureProviderSetupRunning() {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
        state: DesktopControlPlaneActivationStageStates.running,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Configuring deferred feature runtime providers.",
      }));
    },
    markDeferredFeatureProviderSetupReady(metadata) {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
        state: DesktopControlPlaneActivationStageStates.ready,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: false,
        detail: metadata?.detail,
      }));
    },
    markDeferredFeatureProviderSetupBlocked(error) {
      const message = error instanceof Error ? error.message : "Deferred feature runtime provider setup failed.";
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureProviderSetup,
        state: DesktopControlPlaneActivationStageStates.blocked,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Deferred feature runtime provider setup failed.",
        errorMessage: message,
      }));
    },
    markDeferredFeatureIpcRegistrationRunning() {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
        state: DesktopControlPlaneActivationStageStates.running,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Registering deferred feature IPC domains.",
      }));
    },
    markDeferredFeatureIpcRegistrationReady(metadata) {
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
        state: DesktopControlPlaneActivationStageStates.ready,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: false,
        detail: metadata?.detail,
      }));
    },
    markDeferredFeatureIpcRegistrationBlocked(error) {
      const message = error instanceof Error ? error.message : "Deferred feature IPC registration failed.";
      updateActivationStage(Object.freeze({
        stageId: DesktopPostLoginActivationStageIds.deferredFeatureIpcRegistration,
        state: DesktopControlPlaneActivationStageStates.blocked,
        updatedAt: clock.nowIsoString(),
        blockingReadiness: true,
        detail: "Deferred feature IPC registration failed.",
        errorMessage: message,
      }));
    },
    markUnavailable(reason) {
      resetPythonRuntimeResolutionStage();
      resetServiceSupervisorStartupStage();
      resetDeferredFeatureRuntimeCompositionStage();
      resetDeferredFeatureProviderSetupStage();
      resetDeferredFeatureIpcRegistrationStage();
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
