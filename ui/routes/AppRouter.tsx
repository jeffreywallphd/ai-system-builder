import { useMemo } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import HomePage from "../pages/HomePage";
import NotFoundPage from "../pages/NotFoundPage";
import LegacyWorkflowEditorRedirectPage from "../pages/LegacyWorkflowEditorRedirectPage";
import WorkflowConversationPage from "../pages/WorkflowConversationPage";
import ContextWorkbenchPage from "../pages/ContextWorkbenchPage";
import ToolRunPage from "../pages/ToolRunPage";
import SettingsPage from "../pages/SettingsPage";
import AuthorizationSharingManagementPage from "../pages/AuthorizationSharingManagementPage";
import AuthorizationSharingThinClientPage from "../pages/AuthorizationSharingThinClientPage";
import AuthorizationReportingPage from "../pages/AuthorizationReportingPage";
import WorkflowStudioPage from "../pages/WorkflowStudioPage";
import ContextBundleStudioPage from "../pages/ContextBundleStudioPage";
import DatasetPipelineStudioPage from "../pages/DatasetPipelineStudioPage";
import TrainingRecipeStudioPage from "../pages/TrainingRecipeStudioPage";
import ToolChainStudioPage from "../pages/ToolChainStudioPage";
import SystemStudioPage from "../pages/SystemStudioPage";
import ModelStudioPage from "../pages/ModelStudioPage";
import DatasetStudioPage from "../pages/DatasetStudioPage";
import SchemaStudioPage from "../pages/SchemaStudioPage";
import ToolStudioPage from "../pages/ToolStudioPage";
import PromptTemplateStudioPage from "../pages/PromptTemplateStudioPage";
import EmbeddingIndexStudioPage from "../pages/EmbeddingIndexStudioPage";
import ConfigProfileStudioPage from "../pages/ConfigProfileStudioPage";
import BuildPage from "../pages/BuildPage";
import BuildAutomatePage from "../pages/BuildAutomatePage";
import RegistryPage from "../pages/RegistryPage";
import AssetDetailPage from "../pages/AssetDetailPage";
import RunPage from "../pages/RunPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import IdentityAdminPage from "../pages/IdentityAdminPage";
import TrustedDevicesPage from "../pages/TrustedDevicesPage";
import WorkspaceAdministrationPage from "../pages/WorkspaceAdministrationPage";
import NodeEnrollmentReviewPage from "../pages/NodeEnrollmentReviewPage";
import NodeInventoryPage from "../pages/NodeInventoryPage";
import WorkspaceMembershipThinClientPage from "../pages/WorkspaceMembershipThinClientPage";
import WorkspaceInvitationOnboardingPage from "../pages/WorkspaceInvitationOnboardingPage";
import ProtectedRoute from "./ProtectedRoute";
import { ROUTE_PATHS } from "./RouteConfig";
import type { LoginLocalIdentityApiResponse } from "../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { DevLoginFeatureFlag } from "../features/DevLoginFeatureFlag";

export interface AppRouterProps {
  readonly isAuthenticated?: boolean;
  readonly onAuthenticated?: (session: LoginLocalIdentityApiResponse) => void;
  readonly onLogout?: () => Promise<void> | void;
  readonly authNotice?: "session-expired" | "session-invalid";
}

export default function AppRouter({
  isAuthenticated = true,
  onAuthenticated,
  onLogout,
  authNotice,
}: AppRouterProps): JSX.Element {
  const handleAuthenticated = onAuthenticated ?? (() => undefined);
  const handleLogout = onLogout ?? (() => undefined);
  const devLoginEnabled = useMemo(() => new DevLoginFeatureFlag().isEnabled(), []);
  const routes = useMemo<ReadonlyArray<RouteObject>>(
    () => [
      {
        path: ROUTE_PATHS.login,
        element: isAuthenticated
          ? <Navigate to={ROUTE_PATHS.home} replace />
          : <LoginPage onAuthenticated={handleAuthenticated} authNotice={authNotice} devLoginEnabled={devLoginEnabled} />,
      },
      {
        path: ROUTE_PATHS.register,
        element: isAuthenticated
          ? <Navigate to={ROUTE_PATHS.home} replace />
          : <RegisterPage />,
      },
      {
        path: ROUTE_PATHS.workspaceInvitationAccept,
        element: <WorkspaceInvitationOnboardingPage />,
      },
      {
        element: (
          <ProtectedRoute
            isAllowed={isAuthenticated}
            redirectTo={ROUTE_PATHS.login}
          >
            <AppLayout onRequestLogout={handleLogout} />
          </ProtectedRoute>
        ),
        children: [
          { path: ROUTE_PATHS.home, element: <HomePage /> },
          { path: ROUTE_PATHS.build, element: <BuildPage /> },
          { path: ROUTE_PATHS.buildAutomate, element: <BuildAutomatePage /> },
          { path: ROUTE_PATHS.create, element: <Navigate to={ROUTE_PATHS.build} replace /> },
          { path: ROUTE_PATHS.compose, element: <Navigate to={ROUTE_PATHS.build} replace /> },
          { path: ROUTE_PATHS.explore, element: <RegistryPage /> },
          { path: ROUTE_PATHS.run, element: <RunPage /> },
          { path: ROUTE_PATHS.tools, element: <Navigate to={ROUTE_PATHS.run} replace /> },
          { path: ROUTE_PATHS.toolRun, element: <ToolRunPage /> },
          { path: ROUTE_PATHS.workflows, element: <Navigate to={ROUTE_PATHS.build} replace /> },
          {
            path: ROUTE_PATHS.workflowEditor,
            element: <LegacyWorkflowEditorRedirectPage />,
          },
          {
            path: ROUTE_PATHS.workflowConversation,
            element: <WorkflowConversationPage />,
          },
          { path: ROUTE_PATHS.models, element: <Navigate to={ROUTE_PATHS.explore} replace /> },
          { path: ROUTE_PATHS.workflowContextWorkbench, element: <ContextWorkbenchPage /> },
          { path: ROUTE_PATHS.context, element: <Navigate to={ROUTE_PATHS.explore} replace /> },
          { path: ROUTE_PATHS.mcp, element: <Navigate to={ROUTE_PATHS.explore} replace /> },
          { path: ROUTE_PATHS.services, element: <Navigate to={ROUTE_PATHS.explore} replace /> },
          { path: ROUTE_PATHS.assets, element: <Navigate to={ROUTE_PATHS.explore} replace /> },
          { path: ROUTE_PATHS.agentStudio, element: <Navigate to={ROUTE_PATHS.build} replace /> },
          { path: ROUTE_PATHS.studioShell, element: <Navigate to={ROUTE_PATHS.build} replace /> },
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
          { path: ROUTE_PATHS.schemaStudio, element: <SchemaStudioPage /> },
          { path: ROUTE_PATHS.toolStudio, element: <ToolStudioPage /> },
          { path: ROUTE_PATHS.promptTemplateStudio, element: <PromptTemplateStudioPage /> },
          { path: ROUTE_PATHS.embeddingIndexStudio, element: <EmbeddingIndexStudioPage /> },
          { path: ROUTE_PATHS.configProfileStudio, element: <ConfigProfileStudioPage /> },
          { path: ROUTE_PATHS.settings, element: <SettingsPage /> },
          { path: ROUTE_PATHS.authorizationSharing, element: <AuthorizationSharingManagementPage /> },
          { path: ROUTE_PATHS.authorizationSharingThin, element: <AuthorizationSharingThinClientPage /> },
          { path: ROUTE_PATHS.authorizationReporting, element: <AuthorizationReportingPage /> },
          { path: ROUTE_PATHS.workspaceAdmin, element: <WorkspaceAdministrationPage /> },
          { path: ROUTE_PATHS.nodeEnrollmentReview, element: <NodeEnrollmentReviewPage /> },
          { path: ROUTE_PATHS.nodeInventory, element: <NodeInventoryPage /> },
          { path: ROUTE_PATHS.workspaceThinMembership, element: <WorkspaceMembershipThinClientPage /> },
          { path: ROUTE_PATHS.identityAdmin, element: <IdentityAdminPage /> },
          { path: ROUTE_PATHS.trustedDevices, element: <TrustedDevicesPage /> },
        ],
      },
      {
        path: "/index.html",
        element: <Navigate to={isAuthenticated ? ROUTE_PATHS.home : ROUTE_PATHS.login} replace />,
      },
      { path: ROUTE_PATHS.notFound, element: <NotFoundPage /> },
    ],
    [authNotice, devLoginEnabled, handleAuthenticated, handleLogout, isAuthenticated]
  );
  const router = useMemo(() => createBrowserRouter([...routes]), [routes]);

  return (
    <RouterProvider router={router} />
  );
}
