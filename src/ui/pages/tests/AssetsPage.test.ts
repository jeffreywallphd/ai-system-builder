import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("AssetsPage", () => {
  it("renders logical asset workflow operations through shared service seams", () => {
    const source = readSource("ui/pages/AssetsPage.tsx");

    expect(source).toContain('data-testid="asset-workflow-page"');
    expect(source).toContain("new AssetWorkflowService()");
    expect(source).toContain("service.listAssets");
    expect(source).toContain("service.getAssetDetail");
    expect(source).toContain("service.resolvePreview");
    expect(source).toContain("service.authorizeDownload");
    expect(source).toContain("service.initiateUpload");
    expect(source).not.toContain("inputsDirectory");
    expect(source).not.toContain("outputsDirectory");
  });
});
