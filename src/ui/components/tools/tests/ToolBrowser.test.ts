import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolBrowser", () => {
  it("renders tool cards", () => {
    expect(readSource("ui/components/tools/ToolBrowser.tsx")).toContain("ToolCard");
  });
});
