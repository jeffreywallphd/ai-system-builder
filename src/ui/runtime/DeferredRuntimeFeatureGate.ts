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
        "Getting your tools ready",
        "Your workspace tools are starting now. This usually takes a few seconds.",
      ),
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  if (status.state === DesktopPostLoginRuntimeStates.failed) {
    return Object.freeze({
      kind: "error",
      title: "We could not finish startup",
      message: status.failure?.retryable === false
        ? "Your tools stopped while starting and need attention before trying again."
        : "Your tools stopped while starting. Try again to continue.",
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

  if (status.unavailableReason === DesktopPostLoginRuntimeUnavailableReasons.loggedOut) {
    return Object.freeze({
      ...toDisconnectedState(
        "Sign in to continue",
        "Your workspace tools are paused because you are signed out.",
      ),
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  if (status.unavailableReason === DesktopPostLoginRuntimeUnavailableReasons.preLogin) {
    return Object.freeze({
      ...toDisconnectedState(
        "Sign in to start your workspace tools",
        "Sign in first, then we will start the tools needed for this screen.",
      ),
      details: createRuntimeDiagnosticDetails(status),
    });
  }

  return Object.freeze({
    ...toDisconnectedState(
      "Tools are not available yet",
      "We have not started your workspace tools yet. Please wait a moment, then try again.",
    ),
    details: createRuntimeDiagnosticDetails(status),
  });
}

function createRuntimeDiagnosticDetails(status: DesktopPostLoginRuntimeStatus): string {
  const detailTokens: string[] = [
    `runtime=${status.state}`,
    `capability=${status.capabilityPhase}`,
    `transport=${status.transport.phase}`,
    `updated=${status.updatedAt}`,
  ];

  if (status.unavailableReason) {
    detailTokens.push(`reason=${status.unavailableReason}`);
  }

  const blockingStage = status.activationStages?.find((stage) => (
    stage.state === "running"
    || (stage.state === "blocked" && stage.blockingReadiness)
  ));

  if (blockingStage) {
    detailTokens.push(`stage=${blockingStage.stageId}:${blockingStage.state}`);
    if (blockingStage.detail?.trim()) {
      detailTokens.push(`stageDetail=${blockingStage.detail.trim()}`);
    }
    if (blockingStage.errorMessage?.trim()) {
      detailTokens.push(`stageError=${blockingStage.errorMessage.trim()}`);
    }
  }

  if (status.failure?.message?.trim()) {
    detailTokens.push(`failure=${status.failure.message.trim()}`);
  }

  if (status.failure?.failedAt) {
    detailTokens.push(`failedAt=${status.failure.failedAt}`);
  }

  return detailTokens.join(" | ");
}
