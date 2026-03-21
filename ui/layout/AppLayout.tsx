import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useBlocker,
  useBeforeUnload,
  useLocation,
} from "react-router-dom";
import { getNavigationRoutes } from "../routes/RouteConfig";
import DevSyncButton from "../dev/DevSyncButton";
import { useUiDependencies } from "../composition/AppProviders";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";
import RuntimeConsoleDrawer from "../components/execution/RuntimeConsoleDrawer";
import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import logo from "../images/ai-loom-studio-logo.svg";

function navLinkClassName(isActive: boolean): string {
  return isActive
    ? "ui-app__nav-link ui-app__nav-link--active"
    : "ui-app__nav-link";
}

const fallbackConsoleState: RuntimeConsoleState = Object.freeze({
  isExpanded: false,
  activeTab: "health",
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

export default function AppLayout(): JSX.Element {
  const routes = getNavigationRoutes();
  const { config, runtimeConsoleStore, workflowStore } = useUiDependencies();
  const location = useLocation();
  const [runtimeConsoleState, setRuntimeConsoleState] = useState<RuntimeConsoleState>(fallbackConsoleState);
  const previousPathnameRef = useRef(location.pathname);

  useEffect(() => {
    return runtimeConsoleStore.subscribe(setRuntimeConsoleState);
  }, [runtimeConsoleStore]);

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

  const isWideWorkspace =
    location.pathname.startsWith("/workflows/") ||
    location.pathname === "/workflows";

  return (
    <div className="ui-app ui-surface-app">
      <header className="ui-app__header">
        <div className="ui-app__header-inner">
          <Link to="/" className="ui-app__brand" aria-label="AI Loom Studio home">
            <img
              src={logo}
              alt="AI Loom Studio"
              className="ui-app__brand-logo"
            />
          </Link>

          <div
            className="ui-row ui-row--wrap"
            style={{ justifyContent: "flex-end", flex: 1 }}
          >
            {!config.isProductionMode ? <DevSyncButton /> : null}

            <nav className="ui-app__nav" aria-label="Primary">
              {routes.map((route) => (
                <NavLink
                  key={route.key}
                  to={route.path}
                  className={({ isActive }) => navLinkClassName(isActive)}
                  end={route.path === "/"}
                >
                  {route.title}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="ui-app__main">
        <div
          className={`ui-app__main-inner${
            isWideWorkspace ? " ui-app__main-inner--wide" : ""
          }`}
        >
          <Outlet />
        </div>
      </main>

      <RuntimeConsoleDrawer
        isExpanded={runtimeConsoleState.isExpanded}
        activeTab={runtimeConsoleState.activeTab}
        events={runtimeConsoleState.events}
        logs={runtimeConsoleState.logs}
        healthChecks={runtimeConsoleState.healthChecks}
        isRefreshingHealth={runtimeConsoleState.isRefreshingHealth}
        onToggleExpanded={() => runtimeConsoleStore.toggleExpanded()}
        onClearLogs={() => runtimeConsoleStore.clearLogs()}
        onRefreshHealth={() => void runtimeConsoleStore.refreshHealth()}
        onSelectTab={(tab) => runtimeConsoleStore.setActiveTab(tab)}
      />

      <footer className="ui-app__footer">
        <div className="ui-app__footer-inner">
          <span>AI Loom Studio</span>
          <span>Composable AI workflows for non-technical users</span>
        </div>
      </footer>
    </div>
  );
}
