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
    expect(registrationSource).toContain('slot: "dependencies"');
    expect(registrationSource).toContain('slot: "metadata"');
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
});
