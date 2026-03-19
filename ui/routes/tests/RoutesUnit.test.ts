import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/routes unit coverage", () => {
  it("defines route paths and route metadata", () => {
    const source = readSource("ui/routes/RouteConfig.ts");

    expect(source).toContain('export const ROUTE_PATHS = Object.freeze({');
    expect(source).toContain('workflowEditor: "/workflows/:workflowId"');
    expect(source).toContain("export const APP_ROUTES");
    expect(source).toContain('key: "workflow-editor"');
    expect(source).toContain('key: "settings"');
    expect(source).toContain('key: "mcp"');
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
  });
});
