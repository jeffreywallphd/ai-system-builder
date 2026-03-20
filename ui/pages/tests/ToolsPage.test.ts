import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ToolsPage", () => {
  it("uses tool store, capability discovery wording, and developer workflow guidance", () => {
    const source = readSource("ui/pages/ToolsPage.tsx");
    expect(source).toContain("toolStore");
    expect(source).toContain("ToolBrowser");
    expect(source).toContain("Open published tools and enter the details needed to get a result.");
    expect(source).toContain("callable capabilities indexed");
    expect(source).toContain("Developer workflows");
    expect(source).toContain("Build search and browse support");
    expect(source).toContain("Create search support");
    expect(source).toContain("Create browse support");
    expect(source).toContain("Capability search candidates");
    expect(source).toContain("bounded matches");
    expect(source).not.toContain("without editing workflows");
  });
});
