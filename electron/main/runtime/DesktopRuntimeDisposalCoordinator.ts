import { DesktopPostLoginRuntimeUnavailableReasons } from "../../shared/DesktopContracts";
import type { DesktopPostLoginRuntimeStatusStore } from "../DesktopPostLoginRuntimeStatusStore";
import type { DesktopConnectivityRuntimeController } from "../DesktopConnectivityRuntimeController";
import type { DesktopServiceSupervisor } from "../DesktopServiceSupervisor";
import type { AuthoritativeServerHostRuntimeHandle } from "../../../src/hosts/server/AuthoritativeServerCompositionRoot";
import type { DeferredDesktopFeatureRuntime } from "../DeferredDesktopFeatureRuntime";
import type { DesktopAgentRuntimeProvider } from "./DesktopAgentRuntimeProvider";
import type { CanonicalRegistryRuntimeProvider } from "./CanonicalRegistryRuntimeProvider";
import type { DesktopStorageDatabase } from "../../../src/infrastructure/desktop/DesktopStorageDatabase";

type RuntimeDisposalStateAccessors = {
  readonly getPostLoginBootstrapPromise: () => Promise<void> | undefined;
  readonly setPostLoginBootstrapPromise: (promise: Promise<void> | undefined) => void;
  readonly getControlPlaneServerRuntime: () => AuthoritativeServerHostRuntimeHandle | undefined;
  readonly setControlPlaneServerRuntime: (runtime: AuthoritativeServerHostRuntimeHandle | undefined) => void;
  readonly getServiceSupervisor: () => DesktopServiceSupervisor | undefined;
  readonly setServiceSupervisor: (runtime: DesktopServiceSupervisor | undefined) => void;
  readonly getStorageDatabase: () => DesktopStorageDatabase | undefined;
  readonly getDeferredFeatureRuntime: () => DeferredDesktopFeatureRuntime | undefined;
  readonly setDeferredFeatureRuntime: (runtime: DeferredDesktopFeatureRuntime | undefined) => void;
  readonly getAgentRuntimeProvider: () => DesktopAgentRuntimeProvider | undefined;
  readonly setAgentRuntimeProvider: (provider: DesktopAgentRuntimeProvider | undefined) => void;
  readonly getCanonicalRegistryRuntimeProvider: () => CanonicalRegistryRuntimeProvider | undefined;
  readonly setCanonicalRegistryRuntimeProvider: (provider: CanonicalRegistryRuntimeProvider | undefined) => void;
  readonly clearBootstrapContext: () => void;
  readonly resetWarmupStarted: () => void;
  readonly clearAuthShellBootstrapResult: () => void;
  readonly clearDeferredRuntimeFactoryCache: () => void;
};

type CreateDesktopRuntimeDisposalCoordinatorParams = RuntimeDisposalStateAccessors & {
  readonly connectivityRuntimeController: DesktopConnectivityRuntimeController;
  readonly postLoginRuntimeStatusStore: DesktopPostLoginRuntimeStatusStore;
  readonly setIsDisposing: (value: boolean) => void;
};

export type DesktopRuntimeDisposalCoordinator = {
  readonly disposeDesktopRuntimeResources: () => Promise<void>;
  readonly cleanupPostLoginRuntimeActivationArtifacts: () => Promise<void>;
};

export function createDesktopRuntimeDisposalCoordinator(
  params: CreateDesktopRuntimeDisposalCoordinatorParams,
): DesktopRuntimeDisposalCoordinator {
  async function cleanupPostLoginRuntimeActivationArtifacts(): Promise<void> {
    params.connectivityRuntimeController.stopMonitoring();
    await params.getServiceSupervisor()?.stop();
    params.getDeferredFeatureRuntime()?.dispose();
    params.getAgentRuntimeProvider()?.dispose();
    params.getCanonicalRegistryRuntimeProvider()?.dispose();
    params.setDeferredFeatureRuntime(undefined);
    params.setAgentRuntimeProvider(undefined);
    params.setCanonicalRegistryRuntimeProvider(undefined);
    params.clearDeferredRuntimeFactoryCache();
    params.setServiceSupervisor(undefined);
  }

  async function disposeDesktopRuntimeResources(): Promise<void> {
    params.setIsDisposing(true);
    params.postLoginRuntimeStatusStore.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.shuttingDown);
    params.postLoginRuntimeStatusStore.markTransportUnavailable("desktop-runtime-disposal-started");
    const pendingPostLoginBootstrap = params.getPostLoginBootstrapPromise();
    params.setPostLoginBootstrapPromise(undefined);
    await pendingPostLoginBootstrap?.catch(() => undefined);
    params.connectivityRuntimeController.stopMonitoring();
    await params.getControlPlaneServerRuntime()?.stop();
    await params.getServiceSupervisor()?.stop();
    params.getStorageDatabase()?.dispose();
    params.getDeferredFeatureRuntime()?.dispose();
    params.getAgentRuntimeProvider()?.dispose();
    params.getCanonicalRegistryRuntimeProvider()?.dispose();
    params.setDeferredFeatureRuntime(undefined);
    params.setAgentRuntimeProvider(undefined);
    params.setCanonicalRegistryRuntimeProvider(undefined);
    params.clearDeferredRuntimeFactoryCache();
    params.setServiceSupervisor(undefined);
    params.setControlPlaneServerRuntime(undefined);
    params.clearBootstrapContext();
    params.resetWarmupStarted();
    params.clearAuthShellBootstrapResult();
    params.postLoginRuntimeStatusStore.markUnavailable(DesktopPostLoginRuntimeUnavailableReasons.preLogin);
    params.postLoginRuntimeStatusStore.markTransportUnavailable("desktop-runtime-disposal-complete");
    params.setIsDisposing(false);
  }

  return Object.freeze({
    disposeDesktopRuntimeResources,
    cleanupPostLoginRuntimeActivationArtifacts,
  });
}
