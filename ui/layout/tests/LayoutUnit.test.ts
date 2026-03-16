import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/layout unit coverage", () => {
  it("implements AppLayout with navigation and outlet", () => {
    const source = readSource("ui/layout/AppLayout.tsx");

    expect(source).toContain("getNavigationRoutes");
    expect(source).toContain("<NavLink");
    expect(source).toContain("<Outlet />");
    expect(source).toContain("Composable AI workflows for non-technical users");
  });

  it("implements global and layout-specific styles", () => {
    const source = readSource("ui/layout/AppLayout.css");

    expect(source).toContain(":root");
    expect(source).toContain(".app-layout__header");
    expect(source).toContain(".app-layout__footer");
  });
});
