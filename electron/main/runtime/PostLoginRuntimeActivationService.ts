import type { AuthoritativeServerHostRuntimeHandle } from "../../../src/hosts/server/AuthoritativeServerCompositionRoot";
import { AuthoritativeServerCapabilityIds } from "../../../src/hosts/server/AuthoritativeServerCapabilityActivation";
import type { DesktopPostLoginWarmupRequest } from "../../shared/DesktopContracts";
import { DesktopStartupPhases } from "../DesktopStartupContract";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopConnectivityRuntimeController } from "../DesktopConnectivityRuntimeController";
import { logInitializationMemory } from "../InitializationLogging";
import type { AuthShellBootstrapResult } from "./PostLoginRuntimeDependencyActivator";

type CreatePostLoginRuntimeActivationServiceParams = {
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly connectivityRuntimeController: DesktopConnectivityRuntimeController;
  readonly getAuthShellBootstrapResult: () => AuthShellBootstrapResult | undefined;
  readonly getControlPlaneServerRuntime: () => AuthoritativeServerHostRuntimeHandle | undefined;
  readonly activateRuntimeDependencies: (authShell: AuthShellBootstrapResult) => Promise<void>;
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
  let postLoginActivationPromise: Promise<void> | undefined;
  let warmupStarted = false;

  function formatPostLoginWarmupRequestLog(request: DesktopPostLoginWarmupRequest): string {
    return `source=${request.triggerSource}${request.requestedAt ? ` requestedAt=${request.requestedAt}` : ""}`;
  }

  async function startPostLoginWarmup(request: DesktopPostLoginWarmupRequest): Promise<void> {
    console.info(`[ai-loom] Post-login warmup requested (${formatPostLoginWarmupRequestLog(request)}).`);
    if (postLoginActivationPromise) {
      console.info("[ai-loom] Post-login warmup request joined in-flight warmup.");
      await postLoginActivationPromise;
      return;
    }
    if (warmupStarted) {
      console.info("[ai-loom] Post-login warmup request ignored because warmup was already started.");
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

    warmupStarted = true;
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

    postLoginActivationPromise = params.activateRuntimeDependencies(authShell);
    try {
      await postLoginActivationPromise;
      console.info("[ai-loom] Post-login desktop runtime warmup completed.");
    } catch (error) {
      postLoginActivationPromise = undefined;
      params.postLoginRuntimeStatusStore.markFailed(request, error);
      if (!params.isDesktopRuntimeDisposing()) {
        console.error("Post-login desktop runtime activation failed", error);
        await params.disposeDesktopRuntimeResources();
        params.exitProcess(1);
      }
      warmupStarted = false;
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
      warmupStarted = false;
    },
  });
}
