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
    expect(source).toContain('modelStudio: "/studio-shell/model"');
    expect(source).toContain('datasetStudio: "/studio-shell/dataset"');
    expect(source).toContain('toolStudio: "/studio-shell/tool"');
    expect(source).toContain('key: "agent-studio"');
    expect(source).toContain('key: "dataset-studio"');
    expect(source).toContain('key: "tool-studio"');
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
    expect(source).toContain("path: ROUTE_PATHS.modelStudio");
    expect(source).toContain("path: ROUTE_PATHS.datasetStudio");
    expect(source).toContain("path: ROUTE_PATHS.toolStudio");
    expect(source).toContain("path: ROUTE_PATHS.context");
    expect(source).toContain("path: ROUTE_PATHS.workflowContextWorkbench");
  });
});
