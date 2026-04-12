import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("StandardAssetDetailView", () => {
  it("renders standardized section frame with progressive metadata disclosure", () => {
    const source = readSource("ui/components/registry/StandardAssetDetailView.tsx");

    expect(source).toContain('data-testid="standard-asset-detail-view"');
    expect(source).toContain("Primary actions");
    expect(source).toContain("standard-asset-detail-section-${section?.key}");
    expect(source).toContain("Advanced metadata and diagnostics");
  });

  it("wires action buttons through the intent action execution service", () => {
    const source = readSource("ui/components/registry/StandardAssetDetailView.tsx");

    expect(source).toContain("new AssetIntentActionResolver().resolveActions");
    expect(source).toContain("new AssetActionExecutionService");
    expect(source).toContain("executionService.execute(action.type, actionContext)");
  });
});
