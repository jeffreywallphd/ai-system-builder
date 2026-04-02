import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ConfigProfileStudioPage contracts", () => {
  it("binds Config Profile Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/ConfigProfileStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/ConfigProfileStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("configProfileStudioRegistration");
    expect(pageSource).toContain("studioRegistration={configProfileStudioRegistration}");

    expect(registrationSource).toContain("studioType: ConfigProfileStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "config-profile"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("createConfigProfileStudioTaxonomy()");
  });
});
