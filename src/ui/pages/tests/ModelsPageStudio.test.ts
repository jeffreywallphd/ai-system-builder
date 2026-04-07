import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ModelsPage studio workflow", () => {
  it("wires the create-models tab to the guided model-creation studio", () => {
    const pageSource = readSource("ui/pages/ModelsPage.tsx");
    const studioSource = readSource("ui/components/models/ModelTrainingStudio.tsx");

    expect(pageSource).toContain("ModelTrainingStudio");
    expect(pageSource).toContain("Prepare bundle-only outputs or run real local training when this mode supports it.");
    expect(studioSource).toContain("Create a local model");
    expect(studioSource).toContain("Readiness and prerequisites");
    expect(studioSource).toContain("Job history and outputs");
  });
});
