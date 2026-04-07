import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("WorkflowFormSection", () => {
  it("reuses the shared projected section card for author form mode", () => {
    expect(readSource("ui/components/workflow/WorkflowFormSection.tsx")).toContain("ProjectedSectionCard");
  });
});
