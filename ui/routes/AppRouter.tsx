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
import ManagedServicesPage from "../pages/ManagedServicesPage";
import NotFoundPage from "../pages/NotFoundPage";
import WorkflowEditorPage from "../pages/WorkflowEditorPage";
import WorkflowConversationPage from "../pages/WorkflowConversationPage";
import ContextWorkbenchPage from "../pages/ContextWorkbenchPage";
import WorkflowsPage from "../pages/WorkflowsPage";
import ToolsPage from "../pages/ToolsPage";
import ToolRunPage from "../pages/ToolRunPage";
import SettingsPage from "../pages/SettingsPage";
import AgentStudioPage from "../pages/AgentStudioPage";
import StudioShellPage from "../pages/StudioShellPage";
import WorkflowStudioPage from "../pages/WorkflowStudioPage";
import ContextBundleStudioPage from "../pages/ContextBundleStudioPage";
import DatasetPipelineStudioPage from "../pages/DatasetPipelineStudioPage";
import TrainingRecipeStudioPage from "../pages/TrainingRecipeStudioPage";
import ToolChainStudioPage from "../pages/ToolChainStudioPage";
import SystemStudioPage from "../pages/SystemStudioPage";
import ModelStudioPage from "../pages/ModelStudioPage";
import DatasetStudioPage from "../pages/DatasetStudioPage";
import ToolStudioPage from "../pages/ToolStudioPage";
import PromptTemplateStudioPage from "../pages/PromptTemplateStudioPage";
import EmbeddingIndexStudioPage from "../pages/EmbeddingIndexStudioPage";
import ConfigProfileStudioPage from "../pages/ConfigProfileStudioPage";
import BuildPage from "../pages/BuildPage";
import BuildAutomatePage from "../pages/BuildAutomatePage";
import RegistryPage from "../pages/RegistryPage";
import AssetDetailPage from "../pages/AssetDetailPage";
import RunPage from "../pages/RunPage";
import ProtectedRoute from "./ProtectedRoute";
import { ROUTE_PATHS } from "./RouteConfig";
import { NavigationMigrationService } from "./LegacyNavigationSunset";

export interface AppRouterProps {
  readonly isAuthenticated?: boolean;
}

function resolveLegacyRouteElement(path: string, fallback: JSX.Element, migrationService: NavigationMigrationService): JSX.Element {
  const redirectPath = migrationService.resolvePathRedirect(path);
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  return fallback;
}

export default function AppRouter({
  isAuthenticated = true,
}: AppRouterProps): JSX.Element {
  const migrationService = useMemo(() => new NavigationMigrationService(), []);
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
          { path: ROUTE_PATHS.build, element: <BuildPage /> },
          { path: ROUTE_PATHS.buildAutomate, element: <BuildAutomatePage /> },
          { path: ROUTE_PATHS.create, element: resolveLegacyRouteElement(ROUTE_PATHS.create, <Navigate to={ROUTE_PATHS.build} replace />, migrationService) },
          { path: ROUTE_PATHS.compose, element: resolveLegacyRouteElement(ROUTE_PATHS.compose, <Navigate to={ROUTE_PATHS.build} replace />, migrationService) },
          { path: ROUTE_PATHS.explore, element: <RegistryPage /> },
          { path: ROUTE_PATHS.run, element: <RunPage /> },
          { path: ROUTE_PATHS.tools, element: resolveLegacyRouteElement(ROUTE_PATHS.tools, <ToolsPage />, migrationService) },
          { path: ROUTE_PATHS.toolRun, element: <ToolRunPage /> },
          { path: ROUTE_PATHS.workflows, element: resolveLegacyRouteElement(ROUTE_PATHS.workflows, <WorkflowsPage />, migrationService) },
          {
            path: ROUTE_PATHS.workflowEditor,
            element: <WorkflowEditorPage />,
          },
          {
            path: ROUTE_PATHS.workflowConversation,
            element: <WorkflowConversationPage />,
          },
          { path: ROUTE_PATHS.models, element: resolveLegacyRouteElement(ROUTE_PATHS.models, <ModelsPage />, migrationService) },
          { path: ROUTE_PATHS.workflowContextWorkbench, element: <ContextWorkbenchPage /> },
          { path: ROUTE_PATHS.context, element: resolveLegacyRouteElement(ROUTE_PATHS.context, <ContextPage />, migrationService) },
          { path: ROUTE_PATHS.mcp, element: resolveLegacyRouteElement(ROUTE_PATHS.mcp, <McpPage />, migrationService) },
          { path: ROUTE_PATHS.services, element: resolveLegacyRouteElement(ROUTE_PATHS.services, <ManagedServicesPage />, migrationService) },
          { path: ROUTE_PATHS.assets, element: resolveLegacyRouteElement(ROUTE_PATHS.assets, <AssetsPage />, migrationService) },
          { path: ROUTE_PATHS.agentStudio, element: resolveLegacyRouteElement(ROUTE_PATHS.agentStudio, <AgentStudioPage />, migrationService) },
          { path: ROUTE_PATHS.studioShell, element: resolveLegacyRouteElement(ROUTE_PATHS.studioShell, <StudioShellPage />, migrationService) },
          { path: ROUTE_PATHS.registry, element: <RegistryPage /> },
          { path: ROUTE_PATHS.registryAssetDetail, element: <AssetDetailPage /> },
          { path: ROUTE_PATHS.workflowStudio, element: <WorkflowStudioPage /> },
          { path: ROUTE_PATHS.workflowStudioRuns, element: <WorkflowStudioPage /> },
          { path: ROUTE_PATHS.workflowStudioRunDetail, element: <WorkflowStudioPage /> },
          { path: ROUTE_PATHS.workflowStudioMode, element: <WorkflowStudioPage /> },
          { path: ROUTE_PATHS.workflowStudioWizardPage, element: <WorkflowStudioPage /> },
          { path: ROUTE_PATHS.contextBundleStudio, element: <ContextBundleStudioPage /> },
          { path: ROUTE_PATHS.datasetPipelineStudio, element: <DatasetPipelineStudioPage /> },
          { path: ROUTE_PATHS.trainingRecipeStudio, element: <TrainingRecipeStudioPage /> },
          { path: ROUTE_PATHS.toolChainStudio, element: <ToolChainStudioPage /> },
          { path: ROUTE_PATHS.systemStudio, element: <SystemStudioPage /> },
          { path: ROUTE_PATHS.modelStudio, element: <ModelStudioPage /> },
          { path: ROUTE_PATHS.datasetStudio, element: <DatasetStudioPage /> },
          { path: ROUTE_PATHS.toolStudio, element: <ToolStudioPage /> },
          { path: ROUTE_PATHS.promptTemplateStudio, element: <PromptTemplateStudioPage /> },
          { path: ROUTE_PATHS.embeddingIndexStudio, element: <EmbeddingIndexStudioPage /> },
          { path: ROUTE_PATHS.configProfileStudio, element: <ConfigProfileStudioPage /> },
          { path: ROUTE_PATHS.settings, element: <SettingsPage /> },
        ],
      },
      {
        path: "/index.html",
        element: <Navigate to={ROUTE_PATHS.home} replace />,
      },
      { path: ROUTE_PATHS.notFound, element: <NotFoundPage /> },
    ],
    [isAuthenticated, migrationService]
  );
  const router = useMemo(() => createBrowserRouter([...routes]), [routes]);

  return (
    <RouterProvider router={router} />
  );
}
