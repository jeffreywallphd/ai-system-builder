import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/layout unit coverage", () => {
  it("implements AppLayout with navigation, outlet, and dev sync controls", () => {
    const source = readSource("ui/layout/AppLayout.tsx");

    expect(source).toContain("getNavigationRoutes");
    expect(source).toContain("<NavLink");
    expect(source).toContain("<Outlet />");
    expect(source).toContain("DevSyncButton");
    expect(source).toContain("config.isProductionMode");
    expect(source).toContain("RuntimeConsoleDrawer");
    expect(source).toContain("Composable AI workflows for non-technical users");
  });

  it("implements global and layout-specific styles", () => {
    const source = readSource("ui/styles/app.css");

    expect(source).toContain(".ui-app__header");
    expect(source).toContain(".ui-app__footer");
    expect(source).toContain(".ui-app__nav-link");
    expect(source).toContain("runtime-console.css");
  });
});
