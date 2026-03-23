import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ModelTrainingStudio truthfulness", () => {
  it("keeps real training, bundle-only preparation, browser fallback guidance, and promotion language explicit", () => {
    const source = readSource("ui/components/models/ModelTrainingStudio.tsx");

    expect(source).toContain("Start local training");
    expect(source).toContain("Prepare bundle only");
    expect(source).toContain("Browser fallback mode is guided and limited");
    expect(source).toContain("Post-training next step");
    expect(source).toContain("Technical details");
    expect(source).toContain("Adding to library…");
  });
});
