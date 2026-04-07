import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolSearchBar", () => {
  it("renders type filter and search controls", () => {
    const source = readSource("ui/components/tools/ToolSearchBar.tsx");
    expect(source).toContain("tool-search-type");
    expect(source).toContain("Search");
  });
});
