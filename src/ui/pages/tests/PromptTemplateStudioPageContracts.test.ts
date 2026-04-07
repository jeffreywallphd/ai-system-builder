import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("PromptTemplateStudioPage contracts", () => {
  it("binds Prompt Template Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/PromptTemplateStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/PromptTemplateStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("promptTemplateStudioRegistration");
    expect(pageSource).toContain("studioRegistration={promptTemplateStudioRegistration}");

    expect(registrationSource).toContain("studioType: PromptTemplateStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "prompt-template"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain("createPromptTemplateStudioTaxonomy()");
  });
});
