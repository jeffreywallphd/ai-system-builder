import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ModelTrainingStudio copy and empty states", () => {
  it("includes guided empty states and next-step copy for missing models, datasets, and jobs", () => {
    const source = readSource("ui/components/models/ModelTrainingStudio.tsx");

    expect(source).toContain("No installed base models yet");
    expect(source).toContain("No dataset versions are ready yet");
    expect(source).toContain("No jobs yet");
    expect(source).toContain("Recommended next steps");
    expect(source).toContain("What is blocking this path");
  });
});
