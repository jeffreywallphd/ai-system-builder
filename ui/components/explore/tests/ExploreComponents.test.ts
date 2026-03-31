import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("explore UI components", () => {
  it("keeps unified filter panel with primary and secondary metadata facets", () => {
    const source = readSource("ui/components/explore/ExploreFilterPanel.tsx");

    expect(source).toContain("Asset kind");
    expect(source).toContain("Source");
    expect(source).toContain("Status");
    expect(source).toContain("Advanced metadata filters");
    expect(source).toContain("Taxonomy role");
    expect(source).toContain("Taxonomy behavior");
    expect(source).toContain("data-testid=\"explore-filter-panel\"");
  });

  it("keeps mixed-type explore asset list cards with detail navigation", () => {
    const source = readSource("ui/components/explore/ExploreAssetList.tsx");

    expect(source).toContain("data-testid=\"explore-asset-list\"");
    expect(source).toContain("data-testid=\"explore-asset-item\"");
    expect(source).toContain("No assets match the current explore query");
    expect(source).toContain("taxonomy:");
    expect(source).toContain("Open workflow");
    expect(source).toContain("Resume draft");
    expect(source).toContain("Run here");
    expect(source).toContain("Test here");
    expect(source).toContain("View details");
  });
});
