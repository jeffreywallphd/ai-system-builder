import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolSectionView", () => {
  it("reuses the shared projected section card for tool sections", () => {
    expect(readSource("ui/components/tools/ToolSectionView.tsx")).toContain("ProjectedSectionCard");
  });
});
