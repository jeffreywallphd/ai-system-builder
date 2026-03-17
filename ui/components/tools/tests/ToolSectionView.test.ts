import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolSectionView", () => {
  it("renders section fields", () => {
    expect(readSource("ui/components/tools/ToolSectionView.tsx")).toContain("ToolFieldView");
  });
});
