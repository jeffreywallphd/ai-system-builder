import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ToolRunView", () => {
  it("shows run action", () => {
    expect(readSource("ui/components/tools/ToolRunView.tsx")).toContain("Run");
  });
});
