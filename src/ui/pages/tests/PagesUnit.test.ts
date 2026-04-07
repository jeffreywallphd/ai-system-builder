import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages unit coverage", () => {
  it("defines all primary pages", () => {
    const home = readSource("ui/pages/HomePage.tsx");
    const workflows = readSource("ui/pages/WorkflowsPage.tsx");
    const models = readSource("ui/pages/ModelsPage.tsx");
    const context = readSource("ui/pages/ContextPage.tsx");
    const assets = readSource("ui/pages/AssetsPage.tsx");
    const mcp = readSource("ui/pages/McpPage.tsx");
    const storageAdmin = readSource("ui/pages/StorageAdministrationPage.tsx");
    const workspaceAdmin = readSource("ui/pages/WorkspaceAdministrationPage.tsx");
    const notFound = readSource("ui/pages/NotFoundPage.tsx");

    expect(home).toContain("AI Loom Studio");
    expect(workflows).toContain("New Workflow");
    expect(models).toContain("Download Models");
    expect(context).toContain("Context Engineering");
    expect(assets).toContain("Use protected logical asset APIs for listing");
    expect(mcp).toContain("Create new local MCP servers");
    expect(storageAdmin).toContain("Managed storage administration");
    expect(workspaceAdmin).toContain("Workspace administration");
    expect(notFound).toContain("Page Not Found");
  });
});
