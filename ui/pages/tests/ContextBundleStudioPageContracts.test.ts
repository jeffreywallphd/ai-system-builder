import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ContextBundleStudioPage contracts", () => {
  it("binds Context Bundle Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/ContextBundleStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/ContextBundleStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("contextBundleStudioRegistration");
    expect(pageSource).toContain("studioRegistration={contextBundleStudioRegistration}");

    expect(registrationSource).toContain("studioType: ContextBundleStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "context-bundle"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain('createContextBundleStudioTaxonomy("none")');
  });
});
