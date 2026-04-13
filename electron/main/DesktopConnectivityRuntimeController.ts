export const DeferredConnectivityStateDetail = "Connectivity monitoring is deferred until post-login runtime warmup starts.";

type DeferredConnectivityState = {
  readonly state: "connecting";
  readonly stale: false;
  readonly localModeActive: false;
  readonly detail?: string;
  readonly lastChangedAt: string;
  readonly canQueueOperations: true;
  readonly canResynchronize: false;
};

type AuthBootstrapConnectivityState = DeferredConnectivityState | Record<string, unknown>;

type DesktopConnectivityService = {
  readonly getState: () => AuthBootstrapConnectivityState;
  readonly setDeliberateOfflineMode: (active: boolean, detail?: string) => AuthBootstrapConnectivityState;
  readonly startMonitoring: (probePort: unknown, options: { readonly intervalMs: number }) => void;
  readonly stopMonitoring: () => void;
};

type DesktopConnectivityRuntimeControllerDependencies = {
  readonly createConnectivityStateService: () => DesktopConnectivityService;
  readonly createConnectivityProbePort: (controlPlaneBaseUrl: string, lookupToken: (key: string) => string | null) => unknown;
  readonly lookupToken: (key: string) => string | null;
  readonly nowIsoString?: () => string;
};

export type DesktopConnectivityRuntimeController = {
  readonly createDeferredConnectivityState: (detail?: string) => DeferredConnectivityState;
  readonly getConnectivityStateForAuthBootstrapIpc: () => string;
  readonly setConnectivityOfflineModeForAuthBootstrapIpc: (requestJson: string) => string;
  readonly startMonitoring: (controlPlaneBaseUrl: string) => void;
  readonly stopMonitoring: () => void;
  readonly isMonitoringStarted: () => boolean;
};

export function createDesktopConnectivityRuntimeController(
  dependencies: DesktopConnectivityRuntimeControllerDependencies,
): DesktopConnectivityRuntimeController {
  const nowIsoString = dependencies.nowIsoString ?? (() => new Date().toISOString());
  let connectivityStateService: DesktopConnectivityService | undefined;
  let monitoringStarted = false;

  const createDeferredConnectivityState = (detail?: string): DeferredConnectivityState => {
    return Object.freeze({
      state: "connecting",
      stale: false,
      localModeActive: false,
      detail,
      lastChangedAt: nowIsoString(),
      canQueueOperations: true,
      canResynchronize: false,
    });
  };

  return Object.freeze({
    createDeferredConnectivityState,
    getConnectivityStateForAuthBootstrapIpc() {
      if (!monitoringStarted) {
        return JSON.stringify(createDeferredConnectivityState(DeferredConnectivityStateDetail));
      }
      const state = connectivityStateService?.getState() ?? createDeferredConnectivityState();
      return JSON.stringify(state);
    },
    setConnectivityOfflineModeForAuthBootstrapIpc(requestJson: string) {
      const request = JSON.parse(requestJson) as { readonly active?: boolean; readonly detail?: string };
      if (!monitoringStarted || !connectivityStateService) {
        return JSON.stringify(createDeferredConnectivityState(DeferredConnectivityStateDetail));
      }
      const state = connectivityStateService.setDeliberateOfflineMode(request.active === true, request.detail);
      return JSON.stringify(state);
    },
    startMonitoring(controlPlaneBaseUrl: string) {
      if (monitoringStarted) {
        return;
      }
      if (!connectivityStateService) {
        connectivityStateService = dependencies.createConnectivityStateService();
      }
      connectivityStateService.startMonitoring(
        dependencies.createConnectivityProbePort(controlPlaneBaseUrl, (key) => dependencies.lookupToken(key)),
        { intervalMs: 3_000 },
      );
      monitoringStarted = true;
    },
    stopMonitoring() {
      connectivityStateService?.stopMonitoring();
      monitoringStarted = false;
      connectivityStateService = undefined;
    },
    isMonitoringStarted: () => monitoringStarted,
  });
}
