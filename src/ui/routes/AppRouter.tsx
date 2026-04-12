import { lazy, Suspense, useMemo } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import { ROUTE_PATHS } from "./RouteConfig";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import { isRoutePathAccessibleForSession } from "./SurfaceRouteAccessPolicy";
import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { DevLoginFeatureFlag } from "../features/DevLoginFeatureFlag";

const HomePage = lazy(async () => await import("../pages/HomePage"));
const NotFoundPage = lazy(async () => await import("../pages/NotFoundPage"));
const LegacyWorkflowEditorRedirectPage = lazy(async () => await import("../pages/LegacyWorkflowEditorRedirectPage"));
const WorkflowConversationPage = lazy(async () => await import("../pages/WorkflowConversationPage"));
const ContextWorkbenchPage = lazy(async () => await import("../pages/ContextWorkbenchPage"));
const ToolRunPage = lazy(async () => await import("../pages/ToolRunPage"));
const SettingsPage = lazy(async () => await import("../pages/SettingsPage"));
const AuthorizationSharingManagementPage = lazy(async () => await import("../pages/AuthorizationSharingManagementPage"));
const AuthorizationSharingThinClientPage = lazy(async () => await import("../pages/AuthorizationSharingThinClientPage"));
const AuthorizationReportingPage = lazy(async () => await import("../pages/AuthorizationReportingPage"));
const SecurityPolicyConfigurationPage = lazy(async () => await import("../pages/SecurityPolicyConfigurationPage"));
const StorageAdministrationPage = lazy(async () => await import("../pages/StorageAdministrationPage"));
const WorkflowStudioPage = lazy(async () => await import("../pages/WorkflowStudioPage"));
const ContextBundleStudioPage = lazy(async () => await import("../pages/ContextBundleStudioPage"));
const DatasetPipelineStudioPage = lazy(async () => await import("../pages/DatasetPipelineStudioPage"));
const TrainingRecipeStudioPage = lazy(async () => await import("../pages/TrainingRecipeStudioPage"));
const ToolChainStudioPage = lazy(async () => await import("../pages/ToolChainStudioPage"));
const SystemStudioPage = lazy(async () => await import("../pages/SystemStudioPage"));
const ModelStudioPage = lazy(async () => await import("../pages/ModelStudioPage"));
const DatasetStudioPage = lazy(async () => await import("../pages/DatasetStudioPage"));
const SchemaStudioPage = lazy(async () => await import("../pages/SchemaStudioPage"));
const ToolStudioPage = lazy(async () => await import("../pages/ToolStudioPage"));
const PromptTemplateStudioPage = lazy(async () => await import("../pages/PromptTemplateStudioPage"));
const EmbeddingIndexStudioPage = lazy(async () => await import("../pages/EmbeddingIndexStudioPage"));
const ConfigProfileStudioPage = lazy(async () => await import("../pages/ConfigProfileStudioPage"));
const BuildPage = lazy(async () => await import("../pages/BuildPage"));
const BuildAutomatePage = lazy(async () => await import("../pages/BuildAutomatePage"));
const RegistryPage = lazy(async () => await import("../pages/RegistryPage"));
const AssetDetailPage = lazy(async () => await import("../pages/AssetDetailPage"));
const RunPage = lazy(async () => await import("../pages/RunPage"));
const AssetsPage = lazy(async () => await import("../pages/AssetsPage"));
const LoginPage = lazy(async () => await import("../pages/LoginPage"));
const RegisterPage = lazy(async () => await import("../pages/RegisterPage"));
const IdentityAdminPage = lazy(async () => await import("../pages/IdentityAdminPage"));
const TrustedDevicesPage = lazy(async () => await import("../pages/TrustedDevicesPage"));
const WorkspaceAdministrationPage = lazy(async () => await import("../pages/WorkspaceAdministrationPage"));
const NodeEnrollmentReviewPage = lazy(async () => await import("../pages/NodeEnrollmentReviewPage"));
const NodeInventoryPage = lazy(async () => await import("../pages/NodeInventoryPage"));
const WorkspaceMembershipThinClientPage = lazy(async () => await import("../pages/WorkspaceMembershipThinClientPage"));
const WorkspaceInvitationOnboardingPage = lazy(async () => await import("../pages/WorkspaceInvitationOnboardingPage"));
const SecretMetadataManagementPage = lazy(async () => await import("../pages/SecretMetadataManagementPage"));
const GovernanceAuditReviewPage = lazy(async () => await import("../pages/GovernanceAuditReviewPage"));
const DeploymentPolicyAdministrationPage = lazy(async () => await import("../pages/DeploymentPolicyAdministrationPage"));
const DesktopAdministrationShellPage = lazy(async () => await import("../pages/DesktopAdministrationShellPage"));
const AdminLiteEntryPage = lazy(async () => await import("../pages/AdminLiteEntryPage"));

export interface AppRouterProps {
  readonly isAuthenticated?: boolean;
  readonly onAuthenticated?: (session: LoginLocalIdentityApiResponse) => boolean | Promise<boolean>;
  readonly onLogout?: () => Promise<void> | void;
  readonly authNotice?: "session-expired" | "session-invalid" | "session-context-unavailable" | "session-bootstrap-timeout";
}

export default function AppRouter({
  isAuthenticated = true,
  onAuthenticated,
  onLogout,
  authNotice,
}: AppRouterProps): JSX.Element {
  const handleAuthenticated = onAuthenticated ?? (() => true);
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
          { path: ROUTE_PATHS.assets, element: <AssetsPage /> },
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
          {
            path: ROUTE_PATHS.settings,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.settings}>
                <SettingsPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.adminShell,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.adminShell}>
                <DesktopAdministrationShellPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.adminLiteShell,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.adminLiteShell}>
                <AdminLiteEntryPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.authorizationSharing,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.authorizationSharing}>
                <AuthorizationSharingManagementPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.authorizationSharingThin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.authorizationSharingThin}>
                <AuthorizationSharingThinClientPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.authorizationReporting,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.authorizationReporting}>
                <AuthorizationReportingPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.securityPolicy,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.securityPolicy}>
                <SecurityPolicyConfigurationPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.storageAdmin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.storageAdmin}>
                <StorageAdministrationPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.workspaceAdmin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.workspaceAdmin}>
                <WorkspaceAdministrationPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.nodeEnrollmentReview,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.nodeEnrollmentReview}>
                <NodeEnrollmentReviewPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.nodeInventory,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.nodeInventory}>
                <NodeInventoryPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.workspaceThinMembership,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.workspaceThinMembership}>
                <WorkspaceMembershipThinClientPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.identityAdmin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.identityAdmin}>
                <IdentityAdminPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.trustedDevices,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.trustedDevices}>
                <TrustedDevicesPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.secretsAdmin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.secretsAdmin}>
                <SecretMetadataManagementPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.governanceReview,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.governanceReview}>
                <GovernanceAuditReviewPage />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.governanceReviewThin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.governanceReviewThin}>
                <GovernanceAuditReviewPage thin />
              </SurfaceProtectedRoute>
            ),
          },
          {
            path: ROUTE_PATHS.deploymentPolicyAdmin,
            element: (
              <SurfaceProtectedRoute path={ROUTE_PATHS.deploymentPolicyAdmin}>
                <DeploymentPolicyAdministrationPage />
              </SurfaceProtectedRoute>
            ),
          },
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
    <Suspense fallback={<AppRouterLoadingFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

interface SurfaceProtectedRouteProps {
  readonly path: string;
  readonly children: JSX.Element;
}

function SurfaceProtectedRoute({ path, children }: SurfaceProtectedRouteProps): JSX.Element {
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const session = sessionStore.getSession();
  const isAllowed = useMemo(
    () => isRoutePathAccessibleForSession(path, session, { strict: true }),
    [path, session],
  );

  if (!isAllowed) {
    return <Navigate to={ROUTE_PATHS.home} replace />;
  }

  return children;
}

function AppRouterLoadingFallback(): JSX.Element {
  return (
    <div className="app-shell-loading" role="status" aria-live="polite" aria-busy>
      Loading page…
    </div>
  );
}
