import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getNavigationRoutes } from "../routes/RouteConfig";
import DevSyncButton from "../dev/DevSyncButton";
import { useUiDependencies } from "../composition/AppProviders";
import type { RuntimeConsoleState } from "../state/RuntimeConsoleStore";
import RuntimeConsoleDrawer from "../components/execution/RuntimeConsoleDrawer";
import logo from "../images/ai-loom-studio-logo.svg";

function navLinkClassName(isActive: boolean): string {
  return isActive
    ? "ui-app__nav-link ui-app__nav-link--active"
    : "ui-app__nav-link";
}

const fallbackConsoleState: RuntimeConsoleState = Object.freeze({
  isExpanded: false,
  events: Object.freeze([]),
});

export default function AppLayout(): JSX.Element {
  const routes = getNavigationRoutes();
  const { config, runtimeConsoleStore } = useUiDependencies();
  const location = useLocation();
  const [runtimeConsoleState, setRuntimeConsoleState] = useState<RuntimeConsoleState>(fallbackConsoleState);

  useEffect(() => {
    return runtimeConsoleStore.subscribe(setRuntimeConsoleState);
  }, [runtimeConsoleStore]);

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
        events={runtimeConsoleState.events}
        onToggleExpanded={() => runtimeConsoleStore.toggleExpanded()}
        onClearEvents={() => runtimeConsoleStore.clearEvents()}
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
