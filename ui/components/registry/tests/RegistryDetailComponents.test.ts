import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("registry detail UI components", () => {
  it("renders bounded detail panels for summary, contract, provenance, and dependencies", () => {
    const source = readSource("ui/components/registry/AssetDetailPanels.tsx");

    expect(source).toContain("registry-asset-summary-panel");
    expect(source).toContain("registry-asset-contract-panel");
    expect(source).toContain("registry-asset-provenance-panel");
    expect(source).toContain("registry-asset-dependency-summary-panel");
  });

  it("provides dependency graph panel with upstream and downstream sections", () => {
    const source = readSource("ui/components/registry/AssetDetailPanels.tsx");

    expect(source).toContain("registry-asset-graph-panel");
    expect(source).toContain("Upstream dependencies");
    expect(source).toContain("Downstream dependents");
  });
});
