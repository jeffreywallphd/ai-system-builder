import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("registry UI components", () => {
  it("keeps filter panel progressive disclosure and taxonomy facets", () => {
    const source = readSource("ui/components/registry/AssetFilterPanel.tsx");

    expect(source).toContain("Structural kind");
    expect(source).toContain("Advanced filters");
    expect(source).toContain("Semantic role");
    expect(source).toContain("Behavior kind");
    expect(source).toContain("data-testid=\"registry-filter-panel\"");
  });

  it("keeps bounded list and item rendering aligned to registry model", () => {
    const listSource = readSource("ui/components/registry/AssetList.tsx");
    const itemSource = readSource("ui/components/registry/AssetListItem.tsx");

    expect(listSource).toContain("data-testid=\"registry-asset-list\"");
    expect(listSource).toContain("No registry assets match the current filters");
    expect(itemSource).toContain("data-testid=\"registry-asset-item\"");
    expect(itemSource).toContain("View details");
    expect(itemSource).toContain("Open studio");
    expect(itemSource).toContain("asset.taxonomy?.structuralKind");
    expect(itemSource).toContain("asset.taxonomy?.semanticRole");
    expect(itemSource).toContain("asset.taxonomy?.behaviorKind");
  });
});
