import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages unit coverage", () => {
  it("defines all primary pages", () => {
    const home = readSource("ui/pages/HomePage.tsx");
    const workflows = readSource("ui/pages/WorkflowsPage.tsx");
    const editor = readSource("ui/pages/WorkflowEditorPage.tsx");
    const models = readSource("ui/pages/ModelsPage.tsx");
    const context = readSource("ui/pages/ContextPage.tsx");
    const assets = readSource("ui/pages/AssetsPage.tsx");
    const mcp = readSource("ui/pages/McpPage.tsx");
    const notFound = readSource("ui/pages/NotFoundPage.tsx");

    expect(home).toContain("AI Loom Studio");
    expect(workflows).toContain("New Workflow");
    expect(editor).toContain("Workflow Editor");
    expect(models).toContain("Search remote models");
    expect(context).toContain("Treat context as a reusable authoring asset");
    expect(assets).toContain("Browse generated and stored workflow assets");
    expect(mcp).toContain("Manage your MCP servers");
    expect(notFound).toContain("Page Not Found");
  });
});
