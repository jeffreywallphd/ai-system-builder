import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ModelStudioPage contracts", () => {
  it("binds Model Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/ModelStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/ModelStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("modelStudioRegistration");
    expect(pageSource).toContain("studioRegistration={modelStudioRegistration}");

    expect(registrationSource).toContain('studioType: ModelStudioIdentity.studioType');
    expect(registrationSource).toContain('role: "model"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("createModelStudioTaxonomy()");
  });
});
