import { useMemo } from "react";
import {
  DesktopPostLoginRuntimeStates,
  DesktopPostLoginRuntimeUnavailableReasons,
  type DesktopPostLoginRuntimeStatus,
} from "../../../electron/shared/DesktopContracts";
import {
  createLoadingState,
  toDisconnectedState,
  type SurfacePresentationState,
} from "../shared/components/presentation-state";
import { useRendererRuntimeLifecycle } from "./RendererRuntimeLifecycleService";

const DeferredRuntimeUnavailableCode = "AI_LOOM_DESKTOP_FEATURE_API_UNAVAILABLE";
const GatePollingIntervalMs = 900;

export interface DeferredRuntimeFeatureGateState {
  readonly surfaceState?: SurfacePresentationState;
  readonly isRetrying: boolean;
  readonly retry: () => Promise<void>;
}

export function useDeferredRuntimeFeatureGate(pathname: string): DeferredRuntimeFeatureGateState {
  const isGatePath = useMemo(() => isDeferredRuntimeGatePath(pathname), [pathname]);
  const runtimeLifecycle = useRendererRuntimeLifecycle({
    enabled: isGatePath,
    activateOnMount: true,
    pollIntervalMs: GatePollingIntervalMs,
  });

  return Object.freeze({
    surfaceState: buildDeferredRuntimeGateState(runtimeLifecycle.status),
    isRetrying: runtimeLifecycle.isRetrying,
    retry: runtimeLifecycle.retry,
  });
}

export function isDeferredRuntimeGatePath(pathname: string): boolean {
  return pathname === "/build"
    || pathname.startsWith("/build/")
    || pathname === "/explore"
    || pathname.startsWith("/explore/")
    || pathname === "/run"
    || pathname.startsWith("/run/")
    || pathname === "/assets"
    || pathname.startsWith("/assets/")
    || pathname.startsWith("/workflows/")
    || pathname.startsWith("/studio-shell/");
}

export function isDeferredRuntimeUnavailableError(error: unknown): boolean {
  const candidate = error as { code?: unknown };
  return typeof candidate?.code === "string" && candidate.code === DeferredRuntimeUnavailableCode;
}

export function buildDeferredRuntimeGateState(
  status: DesktopPostLoginRuntimeStatus | undefined,
): SurfacePresentationState | undefined {
  if (!status || status.state === DesktopPostLoginRuntimeStates.ready) {
    return undefined;
  }

  if (status.state === DesktopPostLoginRuntimeStates.warming) {
    return Object.freeze({
      ...createLoadingState(
        "Preparing feature services",
        "This feature is still starting in the background. It should be ready in a few seconds.",
      ),
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  if (status.state === DesktopPostLoginRuntimeStates.failed) {
    return Object.freeze({
      kind: "error",
      title: "Feature services failed to start",
      message: "We couldn't start the services needed for this feature. Try again, and check desktop logs if this keeps happening.",
      retryable: status.failure?.retryable ?? true,
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  if (status.unavailableReason === DesktopPostLoginRuntimeUnavailableReasons.shuttingDown) {
    return Object.freeze({
      ...toDisconnectedState(
        "Feature services are shutting down",
        "The desktop runtime is shutting down right now. Wait a moment and try again.",
      ),
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  return Object.freeze({
    ...toDisconnectedState(
      "Feature services are still warming up",
      "Feature services are not available yet. We'll keep trying while the runtime finishes starting.",
    ),
    details: createRuntimeDiagnosticDetails(status),
  });
}

function createRuntimeDiagnosticDetails(status: DesktopPostLoginRuntimeStatus): string {
  const failureMessage = status.failure?.message?.trim();
  const failureSuffix = failureMessage ? ` | failure=${failureMessage}` : "";
  const reasonSuffix = status.unavailableReason ? ` | reason=${status.unavailableReason}` : "";
  return `runtime=${status.state} capability=${status.capabilityPhase} transport=${status.transport.phase}${reasonSuffix} | updated=${status.updatedAt}${failureSuffix}`;
}
