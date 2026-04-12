import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes interactions", () => {
  it("connects AppRouter with RouteConfig and ProtectedRoute", () => {
    const appRouterSource = readSource("src/ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain('import ProtectedRoute from "./ProtectedRoute"');
    expect(appRouterSource).toContain('import { ROUTE_PATHS } from "./RouteConfig"');
    expect(appRouterSource).toContain("redirectTo={ROUTE_PATHS.login}");
    expect(appRouterSource).toContain('const LoginPage = lazy(async () => await import("../pages/LoginPage"));');
    expect(appRouterSource).toContain('const RegisterPage = lazy(async () => await import("../pages/RegisterPage"));');
  });

  it("keeps navigation and 404 route interactions intact", () => {
    const appRouterSource = readSource("src/ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain("element: <NotFoundPage />");
    expect(appRouterSource).toContain("to={isAuthenticated ? ROUTE_PATHS.home : ROUTE_PATHS.login}");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.build, element: <BuildPage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.login");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.register");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.buildAutomate, element: <BuildAutomatePage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.workflowConversation");
    expect(appRouterSource).toContain("<BuildPage />");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.settings}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.securityPolicy}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.workspaceAdmin}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.identityAdmin}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.governanceReview}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.governanceReviewThin}>");
    expect(appRouterSource).toContain("<SurfaceProtectedRoute path={ROUTE_PATHS.deploymentPolicyAdmin}>");
    expect(appRouterSource).toContain("<DesktopAdministrationShellPage />");
    expect(appRouterSource).toContain("<AdminLiteEntryPage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.workspaceAdmin");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.identityAdmin");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.governanceReview");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.governanceReviewThin");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.deploymentPolicyAdmin");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.adminShell");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.adminLiteShell");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.agentStudio, element: <Navigate to={ROUTE_PATHS.build} replace />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.studioShell, element: <Navigate to={ROUTE_PATHS.build} replace />");
    expect(appRouterSource).toContain("element: <RegistryPage />");
    expect(appRouterSource).toContain("element: <AssetDetailPage />");
    expect(appRouterSource).toContain("element: <WorkflowStudioPage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.workflowStudioMode");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.workflowStudioWizardPage");
    expect(appRouterSource).toContain("element: <ContextBundleStudioPage />");
    expect(appRouterSource).toContain("element: <DatasetPipelineStudioPage />");
    expect(appRouterSource).toContain("element: <TrainingRecipeStudioPage />");
    expect(appRouterSource).toContain("element: <ToolChainStudioPage />");
    expect(appRouterSource).toContain("element: <ModelStudioPage />");
    expect(appRouterSource).toContain("element: <DatasetStudioPage />");
    expect(appRouterSource).toContain("element: <SchemaStudioPage />");
    expect(appRouterSource).toContain("element: <ToolStudioPage />");
    expect(appRouterSource).toContain("element: <PromptTemplateStudioPage />");
    expect(appRouterSource).toContain("element: <EmbeddingIndexStudioPage />");
    expect(appRouterSource).toContain("element: <ConfigProfileStudioPage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.mcp, element: <Navigate to={ROUTE_PATHS.explore} replace />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.context, element: <Navigate to={ROUTE_PATHS.explore} replace />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.assets, element: <AssetsPage />");
    expect(appRouterSource).toContain("element: <ContextWorkbenchPage />");
  });
});
