import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("RegistryPage", () => {
  it("integrates shared layout and registry listing/filtering surfaces", () => {
    const source = readSource("ui/pages/RegistryPage.tsx");

    expect(source).toContain('data-testid="registry-page"');
    expect(source).toContain("ui-page");
    expect(source).toContain("RegistryService");
    expect(source).toContain("ExploreFilterPanel");
    expect(source).toContain("SearchBar");
    expect(source).toContain("ExploreAssetList");
    expect(source).toContain("service.searchExploreAssets");
    expect(source).toContain("Showing {assets.length} result(s)");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("registryContextQuery");
    expect(source).toContain("Create new workflow");
    expect(readSource("ui/components/explore/ExploreAssetList.tsx")).toContain("Duplicate");
    expect(readSource("ui/components/explore/ExploreAssetList.tsx")).toContain("buildWorkflowStudioDuplicatePath");
  });
});
