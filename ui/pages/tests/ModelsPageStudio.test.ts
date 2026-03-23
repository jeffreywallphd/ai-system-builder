import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ModelsPage studio workflow", () => {
  it("replaces the create-models placeholder with the fine-tuning studio", () => {
    const pageSource = readSource("ui/pages/ModelsPage.tsx");
    const studioSource = readSource("ui/components/models/ModelTrainingStudio.tsx");

    expect(pageSource).toContain("ModelTrainingStudio");
    expect(studioSource).toContain("Submit real training job");
    expect(studioSource).toContain("Prepare export-only bundle");
    expect(studioSource).toContain("Training jobs");
  });
});
