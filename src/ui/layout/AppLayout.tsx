import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useBlocker,
  useBeforeUnload,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ContextNavigationService } from "../routes/ContextNavigation";
import { useUiDependencies } from "../composition/AppProviders";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";
import RuntimeConsoleDrawer from "../components/execution/RuntimeConsoleDrawer";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import logo from "../images/ai-loom-studio-logo.svg";
import ContextNavigationBar from "../components/navigation/ContextNavigationBar";
import CommandPalette from "../components/navigation/CommandPalette";
import { GlobalCommandTrigger } from "../routes/CommandPalette";
import GuidedOnboardingFlowSurface from "../components/navigation/GuidedOnboardingFlow";
import { SystemRuntimeWindowLaunchQueryParam } from "@application/system-runtime/SystemRuntimeWindowLaunchContract";
import SystemRuntimeWindowHost from "../components/studio-shell/SystemRuntimeWindowHost";
import {
  SurfaceLiveRegion,
  SurfaceSkipLink,
  useSurfaceRouteFocus,
} from "../shared/accessibility";
import DesktopOfflineStatusSurface from "../shared/connectivity/DesktopOfflineStatusSurface";
import { DesktopConnectivityService } from "../shared/connectivity/DesktopConnectivityService";
import { SurfaceStatePanel } from "../shared/components/presentation-state";
import type { OfflineSynchronizationStateSnapshotDto } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { useDeferredRuntimeFeatureGate } from "../runtime/DeferredRuntimeFeatureGate";

const fallbackConsoleState: RuntimeConsoleState = Object.freeze({
  isExpanded: false,
  activeTab: "health",
  logVerbosity: "normal",
  events: Object.freeze([]),
  logs: Object.freeze([]),
  healthChecks: Object.freeze([]),
  isRefreshingHealth: false,
  appState: "starting",
  appStateDetail: "Checking runtime status…",
  canRestartRuntime: false,
  isRestartingRuntime: false,
});

function isWorkflowEditorPath(pathname: string): boolean {
  return pathname.startsWith("/workflows/");
}

function hasWorkflowCanvasContent(workflow: IWorkflow | undefined): boolean {
  return (workflow?.nodes.length ?? 0) > 0;
}

function shouldPromptForWorkflowSave(workflow: IWorkflow | undefined, isDirty: boolean): boolean {
  return Boolean(workflow && isDirty && hasWorkflowCanvasContent(workflow));
}

function getWorkflowEditorExitPrompt(workflowName?: string): string {
  const normalizedName = workflowName?.trim();
  const label = normalizedName ? `\"${normalizedName}\"` : "this workflow";
  return `You have unsaved changes in ${label}. Click OK to save before leaving, or Cancel to discard those changes.`;
}

export interface AppLayoutProps {
  readonly onRequestLogout?: () => Promise<void> | void;
}

export default function AppLayout({ onRequestLogout }: AppLayoutProps): JSX.Element {
  const { runtimeConsoleStore, workflowStore } = useUiDependencies();
  const desktopConnectivityService = useMemo(() => new DesktopConnectivityService(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const contextNavigationService = useMemo(() => new ContextNavigationService(), []);
  const contextNavigation = contextNavigationService.resolve({ pathname: location.pathname, search: location.search });
  const [runtimeConsoleState, setRuntimeConsoleState] = useState<RuntimeConsoleState>(fallbackConsoleState);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [routeAnnouncement, setRouteAnnouncement] = useState<string | undefined>(undefined);
  const [offlineSnapshot, setOfflineSnapshot] = useState<OfflineSynchronizationStateSnapshotDto | undefined>(undefined);
  const [offlineStatusError, setOfflineStatusError] = useState<string | undefined>(undefined);
  const [isOfflineStatusLoading, setOfflineStatusLoading] = useState<boolean>(false);
  const [isOfflineModeTogglePending, setOfflineModeTogglePending] = useState<boolean>(false);
  const globalCommandTrigger = useMemo(() => new GlobalCommandTrigger(), []);
  const previousPathnameRef = useRef(location.pathname);
  const mainContentRef = useRef<HTMLElement>(null);
  const deferredRuntimeGate = useDeferredRuntimeFeatureGate(location.pathname);

  useSurfaceRouteFocus(location.pathname, mainContentRef, {
    onAnnounce: setRouteAnnouncement,
  });

  useEffect(() => {
    return runtimeConsoleStore.subscribe(setRuntimeConsoleState);
  }, [runtimeConsoleStore]);

  const refreshOfflineStatus = useCallback(async () => {
    setOfflineStatusLoading(true);
    try {
      const next = await desktopConnectivityService.getSynchronizationStateSnapshot();
      setOfflineSnapshot(next);
      setOfflineStatusError(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to refresh offline/local mode status.";
      setOfflineStatusError(message);
    } finally {
      setOfflineStatusLoading(false);
    }
  }, [desktopConnectivityService]);

  const toggleOfflineMode = useCallback(async (active: boolean) => {
    setOfflineModeTogglePending(true);
    try {
      await desktopConnectivityService.setOfflineMode({
        active,
        detail: active ? "desktop-shell-toggle" : "desktop-shell-resume",
      });
      await refreshOfflineStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update offline mode.";
      setOfflineStatusError(message);
    } finally {
      setOfflineModeTogglePending(false);
    }
  }, [desktopConnectivityService, refreshOfflineStatus]);

  useEffect(() => {
    void refreshOfflineStatus();
    const interval = window.setInterval(() => {
      void refreshOfflineStatus();
    }, 15_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [refreshOfflineStatus]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const { currentWorkflow, isDirty } = workflowStore.getState();

    if (!shouldPromptForWorkflowSave(currentWorkflow, isDirty)) {
      return false;
    }

    if (!isWorkflowEditorPath(currentLocation.pathname)) {
      return false;
    }

    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    let isCancelled = false;

    const resolveNavigation = async (): Promise<void> => {
      const { currentWorkflow } = workflowStore.getState();
      const shouldSave = window.confirm(
        getWorkflowEditorExitPrompt(currentWorkflow?.metadata.name)
      );

      if (isCancelled) {
        return;
      }

      if (shouldSave) {
        try {
          await workflowStore.saveCurrentWorkflow();
        } catch {
          blocker.reset();
          return;
        }
      }

      workflowStore.clearEditorSession();
      blocker.proceed();
    };

    void resolveNavigation();

    return () => {
      isCancelled = true;
    };
  }, [blocker, workflowStore]);

  useBeforeUnload((event) => {
    const { currentWorkflow, isDirty } = workflowStore.getState();

    if (!shouldPromptForWorkflowSave(currentWorkflow, isDirty) || !isWorkflowEditorPath(location.pathname)) {
      return;
    }

    event.preventDefault();
    event.returnValue = getWorkflowEditorExitPrompt(currentWorkflow?.metadata.name);
  });

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = location.pathname;

    if (
      isWorkflowEditorPath(previousPathname) &&
      !isWorkflowEditorPath(location.pathname)
    ) {
      workflowStore.clearEditorSession();
    }
  }, [location.pathname, workflowStore]);


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!globalCommandTrigger.isOpenCommand(event)) {
        return;
      }
      event.preventDefault();
      setCommandPaletteOpen((value) => !value);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [globalCommandTrigger]);

  const isWideWorkspace =
    location.pathname.startsWith("/workflows/") ||
    location.pathname === "/workflows";
  const isRuntimeWindowLaunch = useMemo(
    () => new URLSearchParams(location.search).has(SystemRuntimeWindowLaunchQueryParam),
    [location.search],
  );

  if (isRuntimeWindowLaunch) {
    return <SystemRuntimeWindowHost />;
  }

  const requestLogout = async (): Promise<void> => {
    if (!onRequestLogout || isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await onRequestLogout();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="ui-app ui-surface-app">
      <SurfaceSkipLink targetId="main-content" />
      <header className="ui-app__header">
        <div className="ui-app__header-inner">
          <Link to="/" className="ui-app__brand" aria-label="AI Loom Studio home">
            <img
              src={logo}
              alt="AI Loom Studio"
              className="ui-app__brand-logo"
            />
          </Link>

          <div className="ui-app__header-actions ui-row ui-row--end">
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => {
                void requestLogout();
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
            <button
              type="button"
              className="ui-button ui-button--ghost ui-button--sm ui-app__menu-trigger"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isCommandPaletteOpen}
              aria-controls="global-navigation-menu"
            >
              <span className="ui-app__menu-trigger-icon" aria-hidden="true">
                <span className="ui-app__menu-trigger-bar" />
                <span className="ui-app__menu-trigger-bar" />
                <span className="ui-app__menu-trigger-bar" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" ref={mainContentRef} tabIndex={-1} className="ui-app__main">
        <div
          className={`ui-app__main-inner${
            isWideWorkspace ? " ui-app__main-inner--wide" : ""
          }`}
        >
          <DesktopOfflineStatusSurface
            snapshot={offlineSnapshot}
            isLoading={isOfflineStatusLoading}
            isTogglingOfflineMode={isOfflineModeTogglePending}
            errorMessage={offlineStatusError}
            onRefresh={() => {
              void refreshOfflineStatus();
            }}
            onToggleOfflineMode={(active) => {
              void toggleOfflineMode(active);
            }}
            onOpenPreservedDrafts={() => {
              void navigate(ROUTE_PATHS.workflowStudio);
            }}
            onOpenSyncConflicts={() => {
              void navigate(ROUTE_PATHS.workflowStudioRuns);
            }}
            onOpenReplayOutcomes={() => {
              void navigate(ROUTE_PATHS.run);
            }}
          />
          <GuidedOnboardingFlowSurface pathname={location.pathname} />
          <ContextNavigationBar model={contextNavigation} />
          {deferredRuntimeGate.surfaceState ? (
            <section className="ui-page">
              <SurfaceStatePanel
                state={deferredRuntimeGate.surfaceState}
                action={deferredRuntimeGate.surfaceState.retryable
                  ? (
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={() => {
                        void deferredRuntimeGate.retry();
                      }}
                      disabled={deferredRuntimeGate.isRetrying}
                    >
                      {deferredRuntimeGate.isRetrying ? "Retrying startup..." : "Retry startup"}
                    </button>
                  )
                  : undefined}
              />
            </section>
          ) : (
            <Outlet />
          )}
        </div>
      </main>

      <RuntimeConsoleDrawer
        isExpanded={runtimeConsoleState.isExpanded}
        activeTab={runtimeConsoleState.activeTab}
        logVerbosity={runtimeConsoleState.logVerbosity}
        events={runtimeConsoleState.events}
        logs={runtimeConsoleState.logs}
        healthChecks={runtimeConsoleState.healthChecks}
        isRefreshingHealth={runtimeConsoleState.isRefreshingHealth}
        onToggleExpanded={() => runtimeConsoleStore.toggleExpanded()}
        onClearLogs={() => runtimeConsoleStore.clearLogs()}
        onRefreshHealth={() => void runtimeConsoleStore.refreshHealth()}
        onSelectTab={(tab) => runtimeConsoleStore.setActiveTab(tab)}
        onLogVerbosityChange={(verbosity) => runtimeConsoleStore.setLogVerbosity(verbosity)}
        onRestartRuntime={() => void runtimeConsoleStore.restartRuntime().catch(() => undefined)}
        canRestartRuntime={runtimeConsoleState.canRestartRuntime}
        isRestartingRuntime={runtimeConsoleState.isRestartingRuntime}
      />

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <SurfaceLiveRegion id="ui-route-change-announcer" message={routeAnnouncement} />

      <footer className="ui-app__footer">
        <div className="ui-app__footer-inner">
          <span>AI Loom Studio</span>
          <span>Composable AI workflows for non-technical users</span>
        </div>
      </footer>
    </div>
  );
}


