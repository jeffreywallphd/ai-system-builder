import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import AssetsPage from "../pages/AssetsPage";
import HomePage from "../pages/HomePage";
import ModelsPage from "../pages/ModelsPage";
import NotFoundPage from "../pages/NotFoundPage";
import WorkflowEditorPage from "../pages/WorkflowEditorPage";
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
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={(
            <ProtectedRoute
              isAllowed={isAuthenticated}
              redirectTo={ROUTE_PATHS.home}
            >
              <AppLayout />
            </ProtectedRoute>
          )}
        >
          <Route path={ROUTE_PATHS.home} element={<HomePage />} />
          <Route path={ROUTE_PATHS.tools} element={<ToolsPage />} />
          <Route path={ROUTE_PATHS.toolRun} element={<ToolRunPage />} />
          <Route path={ROUTE_PATHS.workflows} element={<WorkflowsPage />} />
          <Route
            path={ROUTE_PATHS.workflowEditor}
            element={<WorkflowEditorPage />}
          />
          <Route path={ROUTE_PATHS.models} element={<ModelsPage />} />
          <Route path={ROUTE_PATHS.assets} element={<AssetsPage />} />
          <Route path={ROUTE_PATHS.settings} element={<SettingsPage />} />
        </Route>

        <Route
          path="/index.html"
          element={<Navigate to={ROUTE_PATHS.home} replace />}
        />
        <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
