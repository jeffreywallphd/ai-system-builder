import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolsPage", () => {
  it("uses tool store and browser with bounded capability discovery wording", () => {
    const source = readSource("ui/pages/ToolsPage.tsx");
    expect(source).toContain("toolStore");
    expect(source).toContain("ToolBrowser");
    expect(source).toContain("Open published tools and enter the details needed to get a result.");
    expect(source).toContain("callable capabilities indexed");
    expect(source).toContain("Capability search candidates");
    expect(source).toContain("bounded matches");
    expect(source).not.toContain("without editing workflows");
  });
});
