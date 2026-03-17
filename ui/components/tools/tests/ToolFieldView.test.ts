import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolFieldView", () => {
  it("renders input control", () => {
    expect(readSource("ui/components/tools/ToolFieldView.tsx")).toContain("ui-input");
  });
});
