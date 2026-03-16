import { Link, NavLink, Outlet } from "react-router-dom";
import { getNavigationRoutes } from "../routes/RouteConfig";
import "./AppLayout.css";

function brandClassName(isActive: boolean): string {
  return isActive
    ? "app-layout__nav-link app-layout__nav-link--active"
    : "app-layout__nav-link";
}

export default function AppLayout(): JSX.Element {
  const routes = getNavigationRoutes();

  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <div className="app-layout__header-inner">
          <Link to="/" className="app-layout__brand">
            AI Loom Studio
          </Link>

          <nav className="app-layout__nav" aria-label="Primary">
            {routes.map((route) => (
              <NavLink
                key={route.key}
                to={route.path}
                className={({ isActive }) => brandClassName(isActive)}
                end={route.path === "/"}
              >
                {route.title}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-layout__main">
        <div className="app-layout__content">
          <Outlet />
        </div>
      </main>

      <footer className="app-layout__footer">
        <div className="app-layout__footer-inner">
          <span>AI Loom Studio</span>
          <span>Composable AI workflows for non-technical users</span>
        </div>
      </footer>
    </div>
  );
}
