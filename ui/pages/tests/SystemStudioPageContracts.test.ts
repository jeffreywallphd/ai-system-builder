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
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("SystemCompositionEditor");
    expect(registrationSource).toContain("SystemInterfaceEditor");
    expect(registrationSource).toContain("SystemParameterConfigEditor");
    expect(registrationSource).toContain("SystemCompatibilityInsightsPanel");
    expect(registrationSource).toContain("system-studio-structure-editor");
    expect(registrationSource).toContain("system-studio-interface-editor");
    expect(registrationSource).toContain("system-studio-parameter-editor");
    expect(registrationSource).toContain("system-studio-compatibility-insights");
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
    expect(source).toContain("saveSystemChildComponent");
    expect(source).toContain("removeSystemChildComponent");
    expect(source).toContain("reorderSystemChildComponent");
  });

  it("renders first-class system interface and parameter authoring panels", () => {
    const interfaceSource = readSource("ui/components/studio-shell/SystemInterfaceEditor.tsx");
    const parameterSource = readSource("ui/components/studio-shell/SystemParameterConfigEditor.tsx");
    expect(interfaceSource).toContain("data-testid=\"system-interface-editor\"");
    expect(interfaceSource).toContain("System inputs and outputs");
    expect(interfaceSource).toContain("updateSystemInterfaces");
    expect(parameterSource).toContain("data-testid=\"system-parameter-config-editor\"");
    expect(parameterSource).toContain("System parameters and defaults");
    expect(parameterSource).toContain("updateSystemParameters");
  });

  it("renders bounded recursive compatibility insights from system validation outputs", () => {
    const compatibilitySource = readSource("ui/components/studio-shell/SystemCompatibilityInsightsPanel.tsx");
    expect(compatibilitySource).toContain("data-testid=\"system-compatibility-insights-panel\"");
    expect(compatibilitySource).toContain("Recursive compatibility summary");
    expect(compatibilitySource).toContain("bindingIncompatibilityCount");
    expect(compatibilitySource).toContain("unresolvedNestedSystemCount");
    expect(compatibilitySource).toContain("configurationMismatchCount");
  });
});
