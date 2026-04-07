import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolCard", () => {
  it("links to tool run page", () => {
    expect(readSource("ui/components/tools/ToolCard.tsx")).toContain("/tools/");
  });
});
