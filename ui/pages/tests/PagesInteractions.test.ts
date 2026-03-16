import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages interactions", () => {
  it("uses route config for key navigation links", () => {
    const home = readSource("ui/pages/HomePage.tsx");
    const workflows = readSource("ui/pages/WorkflowsPage.tsx");
    const notFound = readSource("ui/pages/NotFoundPage.tsx");

    expect(home).toContain('import { ROUTE_PATHS } from "../routes/RouteConfig"');
    expect(home).toContain("to={ROUTE_PATHS.workflows}");
    expect(workflows).toContain("ROUTE_PATHS.workflowEditor.replace");
    expect(notFound).toContain("to={ROUTE_PATHS.home}");
  });
});
