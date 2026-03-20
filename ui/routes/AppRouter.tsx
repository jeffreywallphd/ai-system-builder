import { useMemo } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import AssetsPage from "../pages/AssetsPage";
import HomePage from "../pages/HomePage";
import ModelsPage from "../pages/ModelsPage";
import ContextPage from "../pages/ContextPage";
import McpPage from "../pages/McpPage";
import NotFoundPage from "../pages/NotFoundPage";
import WorkflowEditorPage from "../pages/WorkflowEditorPage";
import ContextWorkbenchPage from "../pages/ContextWorkbenchPage";
import WorkflowsPage from "../pages/WorkflowsPage";
import ToolsPage from "../pages/ToolsPage";
import ToolRunPage from "../pages/ToolRunPage";
import SettingsPage from "../pages/SettingsPage";
import ProtectedRoute from "./ProtectedRoute";
import { ROUTE_PATHS } from "./RouteConfig";

export interface AppRouterProps {
  readonly isAuthenticated?: boolean;
}

export default function AppRouter({
  isAuthenticated = true,
}: AppRouterProps): JSX.Element {
  const routes = useMemo<ReadonlyArray<RouteObject>>(
    () => [
      {
        element: (
          <ProtectedRoute
            isAllowed={isAuthenticated}
            redirectTo={ROUTE_PATHS.home}
          >
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: ROUTE_PATHS.home, element: <HomePage /> },
          { path: ROUTE_PATHS.tools, element: <ToolsPage /> },
          { path: ROUTE_PATHS.toolRun, element: <ToolRunPage /> },
          { path: ROUTE_PATHS.workflows, element: <WorkflowsPage /> },
          {
            path: ROUTE_PATHS.workflowEditor,
            element: <WorkflowEditorPage />,
          },
          { path: ROUTE_PATHS.models, element: <ModelsPage /> },
          { path: ROUTE_PATHS.workflowContextWorkbench, element: <ContextWorkbenchPage /> },
          { path: ROUTE_PATHS.context, element: <ContextPage /> },
          { path: ROUTE_PATHS.mcp, element: <McpPage /> },
          { path: ROUTE_PATHS.assets, element: <AssetsPage /> },
          { path: ROUTE_PATHS.settings, element: <SettingsPage /> },
        ],
      },
      {
        path: "/index.html",
        element: <Navigate to={ROUTE_PATHS.home} replace />,
      },
      { path: ROUTE_PATHS.notFound, element: <NotFoundPage /> },
    ],
    [isAuthenticated]
  );
  const router = useMemo(() => createBrowserRouter([...routes]), [routes]);

  return (
    <RouterProvider router={router} />
  );
}
