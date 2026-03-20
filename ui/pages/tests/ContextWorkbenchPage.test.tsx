import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ContextWorkbenchPage", () => {
  it("provides an author-facing workflow context debugging surface", () => {
    const source = readSource("ui/pages/ContextWorkbenchPage.tsx");

    expect(source).toContain("Context Workbench");
    expect(source).toContain("contextService.previewWorkflowContext");
    expect(source).toContain("contextService.previewToolContext");
    expect(source).toContain("contextService.previewAgentContext");
    expect(source).toContain("ContextWorkbench");
    expect(source).toContain("author surface stays separate from the end-user Tools flow");
  });
});
