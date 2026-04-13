import type { AuthoritativeServerHostRuntimeHandle } from "../../../src/hosts/server/AuthoritativeServerCompositionRoot";
import { AuthoritativeServerCapabilityIds } from "../../../src/hosts/server/AuthoritativeServerCapabilityActivation";
import type { DesktopPostLoginWarmupRequest } from "../../shared/DesktopContracts";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopConnectivityRuntimeController } from "../DesktopConnectivityRuntimeController";
import { logInitializationMemory } from "../InitializationLogging";
import {
  FatalPostLoginRuntimeActivationError,
  type AuthShellBootstrapResult,
} from "./PostLoginRuntimeDependencyActivator";
import { ServiceSupervisorActivationStageError } from "./ServiceSupervisorActivationStage";
import {
  logPostLoginActivationDiagnostic,
  summarizeActivationError,
} from "./PostLoginActivationDiagnostics";

type CreatePostLoginRuntimeActivationServiceParams = {
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly connectivityRuntimeController: DesktopConnectivityRuntimeController;
  readonly getAuthShellBootstrapResult: () => AuthShellBootstrapResult | undefined;
  readonly getControlPlaneServerRuntime: () => AuthoritativeServerHostRuntimeHandle | undefined;
  readonly activateRuntimeDependencies: (authShell: AuthShellBootstrapResult) => Promise<void>;
  readonly cleanupRuntimeDependenciesAfterFailure: () => Promise<void>;
  readonly disposeDesktopRuntimeResources: () => Promise<void>;
  readonly isDesktopRuntimeDisposing: () => boolean;
  readonly exitProcess: (code: number) => void;
};

export type PostLoginRuntimeActivationService = {
  readonly startPostLoginWarmup: (request: DesktopPostLoginWarmupRequest) => Promise<void>;
  readonly getPostLoginActivationPromise: () => Promise<void> | undefined;
  readonly setPostLoginActivationPromise: (promise: Promise<void> | undefined) => void;
  readonly resetWarmupStarted: () => void;
};

export function createPostLoginRuntimeActivationService(
  params: CreatePostLoginRuntimeActivationServiceParams,
): PostLoginRuntimeActivationService {
  type RuntimeActivationState = "idle" | "activating" | "ready";
  type ActivationFailureDisposition = {
    readonly retryable: boolean;
    readonly preserveControlPlaneListener: boolean;
  };

  let postLoginActivationPromise: Promise<void> | undefined;
  let runtimeActivationState: RuntimeActivationState = "idle";

  function formatPostLoginWarmupRequestLog(request: DesktopPostLoginWarmupRequest): string {
    return `source=${request.triggerSource}${request.requestedAt ? ` requestedAt=${request.requestedAt}` : ""}`;
  }

  function resolveFailureDisposition(error: unknown): ActivationFailureDisposition {
    if (error instanceof FatalPostLoginRuntimeActivationError) {
      return Object.freeze({
        retryable: false,
        preserveControlPlaneListener: false,
      });
    }
    if (error instanceof ServiceSupervisorActivationStageError) {
      return Object.freeze({
        retryable: true,
        preserveControlPlaneListener: true,
      });
    }
    return Object.freeze({
      retryable: true,
      preserveControlPlaneListener: true,
    });
  }

  function resolveBlockingActivationStageId(): string | undefined {
    const blockedStage = params
      .postLoginRuntimeStatusStore
      .getStatus()
      .activationStages
      ?.find((stage) => stage.state === "blocked");
    return blockedStage?.stageId;
  }

  async function startPostLoginWarmup(request: DesktopPostLoginWarmupRequest): Promise<void> {
    console.info(`[ai-loom] Post-login warmup requested (${formatPostLoginWarmupRequestLog(request)}).`);
    logPostLoginActivationDiagnostic({
      payload: {
        event: "desktop.post-login-activation.warmup.requested",
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
      },
    });
    if (runtimeActivationState === "ready") {
      console.info("[ai-loom] Post-login warmup request ignored because runtime is already ready.");
      logPostLoginActivationDiagnostic({
        payload: {
          event: "desktop.post-login-activation.warmup.ignored-ready",
          triggerSource: request.triggerSource,
          requestedAt: request.requestedAt,
        },
      });
      return;
    }
    if (postLoginActivationPromise) {
      console.info("[ai-loom] Post-login warmup request joined in-flight warmup.");
      logPostLoginActivationDiagnostic({
        payload: {
          event: "desktop.post-login-activation.warmup.joined-inflight",
          triggerSource: request.triggerSource,
          requestedAt: request.requestedAt,
        },
      });
      await postLoginActivationPromise;
      return;
    }

    const authShell = params.getAuthShellBootstrapResult();
    if (!authShell) {
      throw new Error("Auth-shell bootstrap context is unavailable for post-login warmup.");
    }
    const controlPlaneRuntime = params.getControlPlaneServerRuntime();
    if (!controlPlaneRuntime) {
      throw new Error("Desktop control-plane host is unavailable for post-login warmup.");
    }

    runtimeActivationState = "activating";
    const warmupStartedAt = Date.now();
    const warmupStartedAtIso = new Date(warmupStartedAt).toISOString();
    console.info(
      `[ai-loom] Post-login warmup will activate capabilities on persistent control-plane host (${controlPlaneRuntime.address}).`,
    );
    controlPlaneRuntime.activateCapabilities({
      capabilityIds: [AuthoritativeServerCapabilityIds.deferredRuntimeFeatures],
      reason: "desktop-post-login-warmup",
      activatedAt: request.requestedAt,
    });

    params.postLoginRuntimeStatusStore.markWarming(request);
    params.connectivityRuntimeController.startMonitoring(authShell.controlPlaneBaseUrl);
    console.info("[ai-loom] Starting post-login desktop runtime warmup.");
    logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "request-accepted");
    logPostLoginActivationDiagnostic({
      payload: {
        event: "desktop.post-login-activation.warmup.started",
        startedAt: warmupStartedAtIso,
        triggerSource: request.triggerSource,
        requestedAt: request.requestedAt,
        detail: "Warmup accepted and deferred runtime capability activation started.",
        dependencies: Object.freeze([
          "python-runtime",
          "runtime-supervisor",
          "deferred-feature-runtime-container",
          "deferred-feature-providers",
          "deferred-feature-ipc",
        ]),
      },
    });

    postLoginActivationPromise = Promise.resolve().then(() => params.activateRuntimeDependencies(authShell));
    try {
      await postLoginActivationPromise;
      const warmupEndedAt = Date.now();
      runtimeActivationState = "ready";
      postLoginActivationPromise = undefined;
      console.info("[ai-loom] Post-login desktop runtime warmup completed.");
      logPostLoginActivationDiagnostic({
        payload: {
          event: "desktop.post-login-activation.warmup.ready",
          startedAt: warmupStartedAtIso,
          endedAt: new Date(warmupEndedAt).toISOString(),
          durationMs: Math.max(0, warmupEndedAt - warmupStartedAt),
          triggerSource: request.triggerSource,
          requestedAt: request.requestedAt,
          activationMode: params.postLoginRuntimeStatusStore.getStatus().activationMode,
        },
      });
    } catch (error) {
      const warmupEndedAt = Date.now();
      postLoginActivationPromise = undefined;
      runtimeActivationState = "idle";
      const failureDisposition = resolveFailureDisposition(error);
      params.postLoginRuntimeStatusStore.markFailed(request, error, {
        retryable: failureDisposition.retryable,
      });
      if (!params.isDesktopRuntimeDisposing() && !failureDisposition.retryable) {
        console.error("Post-login desktop runtime activation failed", error);
        await params.disposeDesktopRuntimeResources();
        params.exitProcess(1);
      } else if (!params.isDesktopRuntimeDisposing() && failureDisposition.preserveControlPlaneListener) {
        await params.cleanupRuntimeDependenciesAfterFailure();
        console.error(
          "Post-login desktop runtime activation failed in retryable mode; preserving control-plane listener for explicit retry.",
          error,
        );
      }
      const summarizedError = summarizeActivationError(error);
      logPostLoginActivationDiagnostic({
        level: "error",
        payload: {
          event: "desktop.post-login-activation.warmup.failed",
          startedAt: warmupStartedAtIso,
          endedAt: new Date(warmupEndedAt).toISOString(),
          durationMs: Math.max(0, warmupEndedAt - warmupStartedAt),
          triggerSource: request.triggerSource,
          requestedAt: request.requestedAt,
          activationMode: params.postLoginRuntimeStatusStore.getStatus().activationMode,
          retryable: failureDisposition.retryable,
          preserveControlPlaneListener: failureDisposition.preserveControlPlaneListener,
          blockingDependency: "post-login-runtime-activation",
          blockingStageId: resolveBlockingActivationStageId(),
          ...summarizedError,
        },
      });
      throw error;
    }
  }

  return Object.freeze({
    startPostLoginWarmup,
    getPostLoginActivationPromise: () => postLoginActivationPromise,
    setPostLoginActivationPromise: (promise) => {
      postLoginActivationPromise = promise;
    },
    resetWarmupStarted: () => {
      runtimeActivationState = "idle";
      postLoginActivationPromise = undefined;
    },
  });
}
