import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes interactions", () => {
  it("connects AppRouter with RouteConfig and ProtectedRoute", () => {
    const appRouterSource = readSource("ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain('import ProtectedRoute from "./ProtectedRoute"');
    expect(appRouterSource).toContain('import { ROUTE_PATHS } from "./RouteConfig"');
    expect(appRouterSource).toContain("redirectTo={ROUTE_PATHS.home}");
  });

  it("keeps navigation and 404 route interactions intact", () => {
    const appRouterSource = readSource("ui/routes/AppRouter.tsx");

    expect(appRouterSource).toContain("element: <NotFoundPage />");
    expect(appRouterSource).toContain("element: <Navigate to={ROUTE_PATHS.home} replace />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.build, element: <BuildPage />");
    expect(appRouterSource).toContain("path: ROUTE_PATHS.buildAutomate, element: <BuildAutomatePage />");
    expect(appRouterSource).toContain("<BuildPage />");
    expect(appRouterSource).toContain("element: <SettingsPage />");
    expect(appRouterSource).toContain("resolveLegacyRouteElement(ROUTE_PATHS.agentStudio");
    expect(appRouterSource).toContain("resolveLegacyRouteElement(ROUTE_PATHS.studioShell");
    expect(appRouterSource).toContain("element: <RegistryPage />");
    expect(appRouterSource).toContain("element: <AssetDetailPage />");
    expect(appRouterSource).toContain("element: <WorkflowStudioPage />");
    expect(appRouterSource).toContain("element: <ContextBundleStudioPage />");
    expect(appRouterSource).toContain("element: <DatasetPipelineStudioPage />");
    expect(appRouterSource).toContain("element: <TrainingRecipeStudioPage />");
    expect(appRouterSource).toContain("element: <ToolChainStudioPage />");
    expect(appRouterSource).toContain("element: <ModelStudioPage />");
    expect(appRouterSource).toContain("element: <DatasetStudioPage />");
    expect(appRouterSource).toContain("element: <ToolStudioPage />");
    expect(appRouterSource).toContain("element: <PromptTemplateStudioPage />");
    expect(appRouterSource).toContain("element: <EmbeddingIndexStudioPage />");
    expect(appRouterSource).toContain("element: <ConfigProfileStudioPage />");
    expect(appRouterSource).toContain("resolveLegacyRouteElement(ROUTE_PATHS.mcp");
    expect(appRouterSource).toContain("resolveLegacyRouteElement(ROUTE_PATHS.context");
    expect(appRouterSource).toContain("element: <ContextWorkbenchPage />");
  });
});
