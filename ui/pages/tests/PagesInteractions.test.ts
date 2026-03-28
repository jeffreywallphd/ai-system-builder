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
    const notFound = readSource("ui/pages/NotFoundPage.tsx");

    expect(home).toContain('import { ROUTE_PATHS } from "../routes/RouteConfig"');
    expect(home).toContain("to={ROUTE_PATHS.workflows}");
    expect(workflows).toContain("Find Flows");
    expect(workflows).toContain("WorkflowEditorPage");
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
    expect(registry).toContain('data-testid="registry-page"');
    expect(registry).toContain("RegistryService");
    expect(registry).toContain("AssetFilterPanel");
    expect(registry).toContain("AssetList");
    expect(settings).toContain("Advanced runtime settings");
    expect(notFound).toContain("to={ROUTE_PATHS.home}");
  });

  it("wires workflow editor actions to workflow and node stores", () => {
    const editor = readSource("ui/pages/WorkflowEditorPage.tsx");

    expect(editor).toContain("WorkflowMetadataPanel");
    expect(editor).toContain("WorkflowValidationPanel");
    expect(editor).toContain("WorkflowExecutionStatusPanel");
    expect(editor).toContain("WorkflowCanvasToolbar");
    expect(editor).toContain("ConnectionInspector");
    expect(editor).toContain("NodePalette");
    expect(editor).toContain("useUiDependencies");
    expect(editor).toContain("workflowStore.renameCurrentWorkflow");
    expect(editor).toContain("workflowStore.updateCurrentWorkflowDescription");
    expect(editor).toContain("workflowStore.clearSelection()");
    expect(editor).toContain("workflowStore.removeConnection(connectionId)");
    expect(editor).toContain("workflowStore.executeCurrentWorkflow");
    expect(editor).toContain("contextWorkbenchHref");
    expect(editor).toContain("ROUTE_PATHS.workflowContextWorkbench");
    expect(editor).not.toContain("seedStarterNode");
    expect(editor).toContain("ui-canvas-shell__view--active");
    expect(editor).toContain("onViewModeChange={setViewMode}");
    expect(editor).toContain('if (workflowId === "new")');
    expect(editor).toContain("if (!createdNewWorkflowRef.current)");
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

  it("keeps validation UI dismissible within the canvas experience", () => {
    const editor = readSource("ui/pages/WorkflowEditorPage.tsx");

    expect(editor).toContain("dismissedValidationMessages");
    expect(editor).toContain("visibleValidationMessages");
    expect(editor).toContain("ui-validation-overlay--locked");
    expect(editor).toContain("Close");
  });

});
