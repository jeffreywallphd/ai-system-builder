import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("AssetDetailPage", () => {
  it("uses registry service and unified detail/graph panels", () => {
    const source = readSource("ui/pages/AssetDetailPage.tsx");

    expect(source).toContain('data-testid="registry-asset-detail-page"');
    expect(source).toContain("service.getAssetDetail");
    expect(source).toContain("service.getDependencies");
    expect(source).toContain("service.getDependents");
    expect(source).toContain("AssetSummaryPanel");
    expect(source).toContain("AssetContractPanel");
    expect(source).toContain("AssetProvenancePanel");
    expect(source).toContain("AssetDependencySummaryPanel");
    expect(source).toContain("SystemAssetDetailsPanel");
    expect(source).toContain("AssetVersionHistoryPanel");
    expect(source).toContain("AssetLineageView");
    expect(source).toContain("AssetValidationSummary");
    expect(source).toContain("DependencyCompatibilityPanel");
    expect(source).toContain("DependencyGraphPanel");
    expect(source).toContain("StandardAssetDetailView");
  });

  it("keeps registry navigation handoff links and intent-aware context passthrough", () => {
    const source = readSource("ui/pages/AssetDetailPage.tsx");

    expect(source).toContain("Back to results");
    expect(source).toContain("buildFlowSessionId");
    expect(source).toContain("registryContext");
    expect(source).toContain("StandardAssetDetailView asset={asset}");
  });
});
