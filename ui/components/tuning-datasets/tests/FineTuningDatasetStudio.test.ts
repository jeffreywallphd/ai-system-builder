import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("FineTuningDatasetStudio", () => {
  it("provides a wizard-style, version-aware studio for QA and chat completion datasets", () => {
    const source = readSource("ui/components/tuning-datasets/FineTuningDatasetStudio.tsx");

    expect(source).toContain("Wizard progress");
    expect(source).toContain("LinearWizard");
    expect(source).toContain("Version management");
    expect(source).toContain("Selected working version");
    expect(source).toContain("Bulk accept");
    expect(source).toContain("chat_completion");
    expect(source).toContain("openai_chat_jsonl");
    expect(source).toContain("Guided supervised tuning workflow");
  });
});
