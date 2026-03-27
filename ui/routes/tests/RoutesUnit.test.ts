import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes unit coverage", () => {
  it("defines route paths and route metadata", () => {
    const source = readSource("ui/routes/RouteConfig.ts");

    expect(source).toContain('export const ROUTE_PATHS = Object.freeze({');
    expect(source).toContain('workflowEditor: "/workflows/:workflowId"');
    expect(source).toContain('workflowContextWorkbench: "/workflows/:workflowId/context-workbench"');
    expect(source).toContain("export const APP_ROUTES");
    expect(source).toContain('key: "workflow-editor"');
    expect(source).toContain('key: "settings"');
    expect(source).toContain('key: "mcp"');
    expect(source).toContain('key: "services"');
    expect(source).toContain('key: "context"');
    expect(source).toContain('agentStudio: "/agent-studio"');
    expect(source).toContain('registry: "/studio-shell/registry"');
    expect(source).toContain('registryAssetDetail: "/studio-shell/registry/assets/:assetId"');
    expect(source).toContain('workflowStudio: "/studio-shell/workflow"');
    expect(source).toContain('contextBundleStudio: "/studio-shell/context-bundle"');
    expect(source).toContain('datasetPipelineStudio: "/studio-shell/dataset-pipeline"');
    expect(source).toContain('toolChainStudio: "/studio-shell/tool-chain"');
    expect(source).toContain('modelStudio: "/studio-shell/model"');
    expect(source).toContain('datasetStudio: "/studio-shell/dataset"');
    expect(source).toContain('toolStudio: "/studio-shell/tool"');
    expect(source).toContain('promptTemplateStudio: "/studio-shell/prompt-template"');
    expect(source).toContain('embeddingIndexStudio: "/studio-shell/embedding-index"');
    expect(source).toContain('configProfileStudio: "/studio-shell/config-profile"');
    expect(source).toContain('key: "agent-studio"');
    expect(source).toContain('key: "registry"');
    expect(source).toContain('key: "registry-asset-detail"');
    expect(source).toContain('key: "workflow-studio"');
    expect(source).toContain('key: "context-bundle-studio"');
    expect(source).toContain('key: "dataset-pipeline-studio"');
    expect(source).toContain('key: "tool-chain-studio"');
    expect(source).toContain('key: "dataset-studio"');
    expect(source).toContain('key: "tool-studio"');
    expect(source).toContain('key: "prompt-template-studio"');
    expect(source).toContain('key: "embedding-index-studio"');
    expect(source).toContain('key: "config-profile-studio"');
  });

  it("provides navigation helper and protected route behavior", () => {
    const configSource = readSource("ui/routes/RouteConfig.ts");
    const protectedRouteSource = readSource("ui/routes/ProtectedRoute.tsx");

    expect(configSource).toContain("getNavigationRoutes");
    expect(protectedRouteSource).toContain("useLocation");
    expect(protectedRouteSource).toContain("<Navigate");
    expect(protectedRouteSource).toContain("children ?? <Outlet />");
  });

  it("wires route tree to layout and pages", () => {
    const source = readSource("ui/routes/AppRouter.tsx");

    expect(source).toContain("createBrowserRouter");
    expect(source).toContain("<RouterProvider router={router} />");
    expect(source).toContain("<ProtectedRoute");
    expect(source).toContain("path: ROUTE_PATHS.notFound");
    expect(source).toContain('path: "/index.html"');
    expect(source).toContain("path: ROUTE_PATHS.settings");
    expect(source).toContain("path: ROUTE_PATHS.mcp");
    expect(source).toContain("path: ROUTE_PATHS.services");
    expect(source).toContain("path: ROUTE_PATHS.agentStudio");
    expect(source).toContain("path: ROUTE_PATHS.studioShell");
    expect(source).toContain("path: ROUTE_PATHS.registry");
    expect(source).toContain("path: ROUTE_PATHS.registryAssetDetail");
    expect(source).toContain("path: ROUTE_PATHS.workflowStudio");
    expect(source).toContain("path: ROUTE_PATHS.contextBundleStudio");
    expect(source).toContain("path: ROUTE_PATHS.datasetPipelineStudio");
    expect(source).toContain("path: ROUTE_PATHS.trainingRecipeStudio");
    expect(source).toContain("path: ROUTE_PATHS.toolChainStudio");
    expect(source).toContain("path: ROUTE_PATHS.modelStudio");
    expect(source).toContain("path: ROUTE_PATHS.datasetStudio");
    expect(source).toContain("path: ROUTE_PATHS.toolStudio");
    expect(source).toContain("path: ROUTE_PATHS.promptTemplateStudio");
    expect(source).toContain("path: ROUTE_PATHS.embeddingIndexStudio");
    expect(source).toContain("path: ROUTE_PATHS.configProfileStudio");
    expect(source).toContain("path: ROUTE_PATHS.context");
    expect(source).toContain("path: ROUTE_PATHS.workflowContextWorkbench");
  });
});
