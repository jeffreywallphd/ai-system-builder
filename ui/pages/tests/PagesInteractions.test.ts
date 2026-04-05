import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/pages interactions", () => {
  it("uses route config for key navigation links", () => {
    const home = readSource("ui/pages/HomePage.tsx");
    const workflows = readSource("ui/pages/WorkflowsPage.tsx");
    const models = readSource("ui/pages/ModelsPage.tsx");
    const settings = readSource("ui/pages/SettingsPage.tsx");
    const context = readSource("ui/pages/ContextPage.tsx");
    const mcp = readSource("ui/pages/McpPage.tsx");
    const agentStudio = readSource("ui/pages/AgentStudioPage.tsx");
    const studioShell = readSource("ui/pages/StudioShellPage.tsx");
    const registry = readSource("ui/pages/RegistryPage.tsx");
    const build = readSource("ui/pages/BuildPage.tsx");
    const buildAutomate = readSource("ui/pages/BuildAutomatePage.tsx");
    const notFound = readSource("ui/pages/NotFoundPage.tsx");

    expect(home).toContain('import { ROUTE_PATHS } from "../routes/RouteConfig"');
    expect(home).toContain("to={ROUTE_PATHS.workflows}");
    expect(workflows).toContain("Find Flows");
    expect(workflows).not.toContain("WorkflowEditorPage");
    expect(workflows).toContain("buildWorkflowStudioCreateNewPath");
    expect(workflows).toContain("WorkflowBrowser");
    expect(workflows).toContain("workflowStore.refreshWorkflows");
    expect(models).toContain("to={ROUTE_PATHS.settings}");
    expect(context).toContain("ContextEngineeringLibrary");
    expect(context).toContain("FineTuningDatasetStudio");
    expect(settings).toContain("Auto-save is enabled");
    expect(mcp).toContain("McpServerBrowser");
    expect(mcp).toContain("mcpStore.addConfiguredServer");
    expect(agentStudio).toContain('data-testid="agent-studio-shell"');
    expect(agentStudio).toContain("AgentStudioService");
    expect(agentStudio).toContain("<AgentListPanel");
    expect(agentStudio).toContain("<AgentDetailPanel");
    expect(studioShell).toContain('data-testid="studio-shell-page"');
    expect(studioShell).toContain("StudioShellService");
    expect(studioShell).toContain("readAutomationIntentFromSearch");
    expect(studioShell).toContain("BuildIntents.automateTask");
    expect(registry).toContain('data-testid="registry-page"');
    expect(registry).toContain("RegistryService");
    expect(registry).toContain("ExploreFilterPanel");
    expect(registry).toContain("ExploreAssetList");
    expect(build).toContain("buildEntryService.getLandingModel()");
    expect(build).toContain("Build from a Template");
    expect(build).toContain("BuildIntents.automateTask");
    expect(build).toContain("ROUTE_PATHS.buildAutomate");
    expect(buildAutomate).toContain("What do you want to automate?");
    expect(buildAutomate).toContain("Continue");
    expect(buildAutomate).toContain("Back to Build");
    expect(buildAutomate).toContain("appendAutomationIntentToPath");
    expect(buildAutomate).toContain("BuildIntents.automateTask");
    expect(settings).toContain("Advanced runtime settings");
    expect(settings).toContain("Workspace administration");
    expect(settings).toContain("Workspace memberships");
    expect(notFound).toContain("to={ROUTE_PATHS.home}");
  });

  it("guards workflow editor navigation and clears stale editor state outside the tool", () => {
    const layout = readSource("ui/layout/AppLayout.tsx");
    const store = readSource("ui/state/WorkflowStore.ts");

    expect(layout).toContain("useBlocker");
    expect(layout).not.toContain("unstable_useBlocker");
    expect(layout).toContain("useBeforeUnload");
    expect(layout).toContain("workflowStore.clearEditorSession()");
    expect(layout).toContain("workflowStore.saveCurrentWorkflow()");
    expect(store).toContain("public clearEditorSession(): void");
  });

});
