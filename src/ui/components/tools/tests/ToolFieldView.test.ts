import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolFieldView", () => {
  it("reuses the shared projected field editor for tool inputs", () => {
    expect(readSource("ui/components/tools/ToolFieldView.tsx")).toContain("ProjectedFieldEditor");
  });
});
