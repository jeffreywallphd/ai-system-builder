import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("SystemStudioPage contracts", () => {
  it("binds System Studio route surface to the shared Studio Shell page with system registration", () => {
    const pageSource = readSource("ui/pages/SystemStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/SystemStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("systemStudioRegistration");
    expect(pageSource).toContain("studioRegistration={systemStudioRegistration}");

    expect(registrationSource).toContain("studioType: SystemStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "system"');
    expect(registrationSource).toContain('role: "system"');
    expect(registrationSource).toContain("createSystemStudioTaxonomy(\"system\", \"deterministic\")");
    expect(registrationSource).toContain('supportsSystemAssets: true');
    expect(registrationSource).toContain('supportsNestedSystemAssets: true');
    expect(registrationSource).toContain("experienceAssets");
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("system-studio-advanced-setup");
    expect(registrationSource).toContain("system-studio-advanced-validation");
    expect(registrationSource).toContain("SystemRuntimeRunPanel");
    expect(registrationSource).toContain("system-studio-runtime-run-trigger");
    expect(registrationSource).toContain("Advanced setup");
    expect(registrationSource).toContain("Advanced validation and debug");
    expect(registrationSource).toContain('slot: "dependencies"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain('slot: "validation"');
  });

  it("keeps System Studio wired into shared route and navigation configuration", () => {
    const routerSource = readSource("ui/routes/AppRouter.tsx");
    const routesConfigSource = readSource("ui/routes/RouteConfig.ts");

    expect(routerSource).toContain("import SystemStudioPage");
    expect(routerSource).toContain("path: ROUTE_PATHS.systemStudio");
    expect(routerSource).toContain("element: <SystemStudioPage />");

    expect(routesConfigSource).toContain('systemStudio: "/studio-shell/system"');
    expect(routesConfigSource).toContain('key: "system-studio"');
    expect(routesConfigSource).toContain('title: "System Studio"');
  });

  it("renders bounded system composition editor and nested-system summary surfaces", () => {
    const source = readSource("ui/components/studio-shell/SystemCompositionEditor.tsx");
    expect(source).toContain("data-testid=\"system-composition-editor\"");
    expect(source).toContain("System composition structure editor");
    expect(source).toContain("Selected components");
    expect(source).toContain("Nested system summary");
    expect(source).toContain("componentKind === \"system\"");
    expect(source).toContain("Open detail");
    expect(source).toContain("Open child in studio");
    expect(source).toContain("Open nested system");
    expect(source).toContain("buildStudioHandoffQuery");
    expect(source).toContain("InlineAssetCreationService");
    expect(source).toContain("inlineCreationLinks");
    expect(source).toContain("saveSystemChildComponent");
    expect(source).toContain("removeSystemChildComponent");
    expect(source).toContain("reorderSystemChildComponent");
  });

  it("renders first-class system interface and parameter authoring panels", () => {
    const interfaceSource = readSource("ui/components/studio-shell/SystemInterfaceEditor.tsx");
    const parameterSource = readSource("ui/components/studio-shell/SystemParameterConfigEditor.tsx");
    const executionMetadataSource = readSource("ui/components/studio-shell/SystemExecutionMetadataEditor.tsx");
    expect(interfaceSource).toContain("data-testid=\"system-interface-editor\"");
    expect(interfaceSource).toContain("System inputs and outputs");
    expect(interfaceSource).toContain("updateSystemInterfaces");
    expect(parameterSource).toContain("data-testid=\"system-parameter-config-editor\"");
    expect(parameterSource).toContain("System parameters and defaults");
    expect(parameterSource).toContain("updateSystemParameters");
    expect(executionMetadataSource).toContain("data-testid=\"system-execution-metadata-editor\"");
    expect(executionMetadataSource).toContain("System execution metadata");
    expect(executionMetadataSource).toContain("Runtime capability binding (bounded)");
    expect(executionMetadataSource).toContain("Model binding ID");
    expect(executionMetadataSource).toContain("selected model/checkpoint binding");
    expect(executionMetadataSource).toContain("updateSystemExecutionMetadata");
  });

  it("uses reusable wizard/canvas experience assets for system draft authoring", () => {
    const shellPageSource = readSource("ui/pages/StudioShellPage.tsx");
    const boundarySource = readSource("ui/components/studio-shell/system/SystemStudioDraftAuthoringBoundary.tsx");
    const canvasAdapterSource = readSource("ui/studio-shell/system/SystemCanvasExperienceAdapter.tsx");

    expect(shellPageSource).toContain("StudioAssetHostBoundary");
    expect(shellPageSource).toContain("systemStudioSurfaceAssetDefinition");
    expect(boundarySource).not.toContain("ExperienceAssetAuthoringBoundary");
    expect(boundarySource).toContain("SystemPageSetupEditor");
    expect(boundarySource).toContain("ConfigurableCanvasSurface");
    expect(canvasAdapterSource).toContain("Page structure");
    expect(canvasAdapterSource).toContain("add-panel");
    expect(canvasAdapterSource).toContain("Add page section");
    expect(canvasAdapterSource).toContain("remove-panel");
    expect(canvasAdapterSource).toContain("Structure only");
    expect(canvasAdapterSource).not.toContain("SystemCompositionEditor");
    expect(canvasAdapterSource).not.toContain("SystemInterfaceEditor");
    expect(canvasAdapterSource).not.toContain("SystemParameterConfigEditor");
  });

  it("wires a bounded run trigger panel through the shared System Studio extension surface", () => {
    const runtimePanelSource = readSource("ui/components/studio-shell/SystemRuntimeRunPanel.tsx");
    expect(runtimePanelSource).toContain("data-testid=\"system-runtime-run-panel\"");
    expect(runtimePanelSource).toContain("Run System");
    expect(runtimePanelSource).toContain("UxRuntimeService");
    expect(runtimePanelSource).toContain("launchSystemRun");
    expect(runtimePanelSource).toContain("getSystemExecutionStatus");
    expect(runtimePanelSource).toContain("getSystemExecutionTrace");
    expect(runtimePanelSource).toContain("getSystemExecutionResult");
    expect(runtimePanelSource).toContain("ExecutionMonitorPanel");
    expect(runtimePanelSource).toContain("ExecutionResultPanel");
    expect(runtimePanelSource).toContain("Auto-refresh every 2s");
    expect(runtimePanelSource).toContain("AssetDraftLifecycleStatuses.validated");
  });

  it("renders bounded recursive compatibility insights from system validation outputs", () => {
    const compatibilitySource = readSource("ui/components/studio-shell/SystemCompatibilityInsightsPanel.tsx");
    expect(compatibilitySource).toContain("data-testid=\"system-compatibility-insights-panel\"");
    expect(compatibilitySource).toContain("Recursive compatibility summary");
    expect(compatibilitySource).toContain("bindingIncompatibilityCount");
    expect(compatibilitySource).toContain("unresolvedNestedSystemCount");
    expect(compatibilitySource).toContain("configurationMismatchCount");
  });

  it("renders a bounded system context preview/debug surface for trigger payload inspection", () => {
    const source = readSource("ui/components/studio-shell/SystemContextDebugPreviewPanel.tsx");
    expect(source).toContain("data-testid=\"system-context-debug-preview-panel\"");
    expect(source).toContain("System context preview + debug");
    expect(source).toContain("normalized context");
    expect(source).toContain("Dataset resolution output");
    expect(source).toContain("Workflow context binding output");
    expect(source).toContain("Enriched trigger payload preview");
    expect(source).toContain("SystemContextDebugPreviewService");
  });
});
