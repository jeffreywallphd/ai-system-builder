import { Link, NavLink, Outlet } from "react-router-dom";
import { getNavigationRoutes } from "../routes/RouteConfig";

function navLinkClassName(isActive: boolean): string {
  return isActive
    ? "ui-app__nav-link ui-app__nav-link--active"
    : "ui-app__nav-link";
}

export default function AppLayout(): JSX.Element {
  const routes = getNavigationRoutes();

  return (
    <div className="ui-app ui-surface-app">
      <header className="ui-app__header">
        <div className="ui-app__header-inner">
          <Link to="/" className="ui-app__brand">
            AI Loom Studio
          </Link>

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
      </header>

      <main className="ui-app__main">
        <div className="ui-app__main-inner">
          <Outlet />
        </div>
      </main>

      <footer className="ui-app__footer">
        <div className="ui-app__footer-inner">
          <span>AI Loom Studio</span>
          <span>Composable AI workflows for non-technical users</span>
        </div>
      </footer>
    </div>
  );
}
