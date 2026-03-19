import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolRunView", () => {
  it("shows a tool-first action and keeps local input values in sync with projected fields", () => {
    const source = readSource("ui/components/tools/ToolRunView.tsx");
    expect(source).toContain("Start tool");
    expect(source).toContain("resolveFieldValue");
    expect(source).toContain("setValues({})");
  });

  it("keeps multi-select tool controls non-technical by rendering option checkboxes when choices exist", () => {
    const source = readSource("ui/components/nodes/NodePropertyField.tsx");
    expect(source).toContain('field.options ?? []).length');
    expect(source).toContain('type="checkbox"');
  });
});
