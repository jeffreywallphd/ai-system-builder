import type {
  DesktopPostLoginRuntimeStatus,
  DesktopPostLoginRuntimeUnavailableReason,
  DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import {
  DesktopPostLoginRuntimeActivationModes,
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
} from "../shared/DesktopContracts";

type PostLoginRuntimeStatusClock = {
  readonly nowIsoString: () => string;
};

export type DesktopPostLoginRuntimeStatusStore = {
  readonly getStatus: () => DesktopPostLoginRuntimeStatus;
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
  let status: DesktopPostLoginRuntimeStatus = Object.freeze({
    state: DesktopPostLoginRuntimeStates.unavailable,
    unavailableReason: DesktopPostLoginRuntimeUnavailableReasons.preLogin,
    updatedAt: clock.nowIsoString(),
  });

  return Object.freeze({
    getStatus: () => status,
    markUnavailable(reason) {
      status = Object.freeze({
        state: DesktopPostLoginRuntimeStates.unavailable,
        unavailableReason: reason,
        updatedAt: clock.nowIsoString(),
      });
    },
    markWarming(request) {
      status = Object.freeze({
        state: DesktopPostLoginRuntimeStates.warming,
        activationMode: resolveActivationMode(request),
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
        updatedAt: clock.nowIsoString(),
      });
    },
    markReady() {
      status = Object.freeze({
        ...status,
        state: DesktopPostLoginRuntimeStates.ready,
        failure: undefined,
        updatedAt: clock.nowIsoString(),
      });
    },
    markFailed(request, error) {
      const message = error instanceof Error ? error.message : "Post-login runtime warmup failed.";
      status = Object.freeze({
        state: DesktopPostLoginRuntimeStates.failed,
        activationMode: resolveActivationMode(request),
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
        updatedAt: clock.nowIsoString(),
        failure: Object.freeze({
          message,
          failedAt: clock.nowIsoString(),
          retryable: true,
        }),
      });
    },
  });
}
