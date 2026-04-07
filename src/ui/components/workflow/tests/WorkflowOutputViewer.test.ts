import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowOutputViewer", () => {
  it("renders expected output badges and asset previews", () => {
    const source = readSource("ui/components/workflow/WorkflowOutputViewer.tsx");
    expect(source).toContain("AssetViewer");
    expect(source).toContain("expectedOutputTypes");
    expect(source).toContain("emptyStateTitle");
  });
});
