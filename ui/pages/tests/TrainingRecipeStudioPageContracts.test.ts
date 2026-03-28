import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("TrainingRecipeStudioPage contracts", () => {
  it("binds Training Recipe Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/TrainingRecipeStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/TrainingRecipeStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("trainingRecipeStudioRegistration");
    expect(pageSource).toContain("studioRegistration={trainingRecipeStudioRegistration}");

    expect(registrationSource).toContain("studioType: TrainingRecipeStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "training-recipe"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain("createTrainingRecipeStudioTaxonomy()");
  });
});
