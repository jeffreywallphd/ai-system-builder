import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ContextPage", () => {
  it("renders the new tabbed context workspace and preserves both authoring surfaces", () => {
    const pageSource = readSource("ui/pages/ContextPage.tsx");
    const engineeringSource = readSource("ui/components/context/ContextEngineeringLibrary.tsx");
    const tuningSource = readSource("ui/components/tuning-datasets/FineTuningDatasetStudio.tsx");

    expect(pageSource).toContain("Context Engineering");
    expect(pageSource).toContain("Fine-Tuning Dataset");
    expect(pageSource).toContain('useSearchParams');
    expect(pageSource).toContain("ContextEngineeringLibrary");
    expect(pageSource).toContain("FineTuningDatasetStudio");

    expect(engineeringSource).toContain("Reusable instructions tabs");
    expect(engineeringSource).toContain("Prompt pack library");
    expect(engineeringSource).toContain("ContextPackageEditor");

    expect(tuningSource).toContain("Fine-Tuning Dataset Studio");
    expect(tuningSource).toContain("Wizard progress");
    expect(tuningSource).toContain("Version management");
    expect(tuningSource).toContain("Generate QA examples");
    expect(tuningSource).toContain("Bulk accept");
    expect(tuningSource).toContain("chat_completion");
    expect(tuningSource).toContain("openai_chat_jsonl");
  });
});
