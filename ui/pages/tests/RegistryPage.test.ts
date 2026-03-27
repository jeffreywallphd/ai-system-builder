import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("RegistryPage", () => {
  it("integrates shared layout and registry listing/filtering surfaces", () => {
    const source = readSource("ui/pages/RegistryPage.tsx");

    expect(source).toContain('data-testid="registry-page"');
    expect(source).toContain("ui-page");
    expect(source).toContain("RegistryService");
    expect(source).toContain("AssetFilterPanel");
    expect(source).toContain("SearchBar");
    expect(source).toContain("AssetList");
    expect(source).toContain("service.filterAssets");
    expect(source).toContain("service.searchAssets");
    expect(source).toContain("Showing {assets.length} result(s)");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("registryContextQuery");
    expect(readSource("ui/components/registry/AssetListItem.tsx")).toContain("View details");
  });
});
