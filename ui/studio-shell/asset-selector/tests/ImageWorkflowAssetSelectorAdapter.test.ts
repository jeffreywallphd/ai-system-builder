import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowAssetSelectorAdapter,
  createImageWorkflowAssetSelectorRequest,
} from "../ImageWorkflowAssetSelectorAdapter";

describe("ImageWorkflowAssetSelectorAdapter", () => {
  it("builds workflow-typed selector requests for image transformation authoring", () => {
    const request = createImageWorkflowAssetSelectorRequest({
      requestId: "selector:image-workflows",
      originatingStudio: "workflow-studio",
      originatingField: "steps.image-transform",
      usageContext: "workflow-image-transform",
    });

    expect(request.assetType).toBe("workflow");
    expect(request.context.usageContext).toBe("workflow-image-transform");
    expect(request.constraints.minSelections).toBe(1);
  });

  it("surfaces image workflow assets with inspectable metadata and bounded config summaries", async () => {
    const adapter = new ImageWorkflowAssetSelectorAdapter();
    const request = createImageWorkflowAssetSelectorRequest({
      requestId: "selector:image-workflows",
      originatingStudio: "workflow-studio",
      originatingField: "steps.image-transform",
      usageContext: "workflow-image-transform",
    });

    const response = await adapter.query({ request, searchTerm: "restyle" });
    expect(response.error).toBeUndefined();
    expect(response.items.length).toBe(1);

    const item = response.items[0];
    expect(item?.asset.assetType).toBe("workflow");
    expect(item?.asset.taxonomy?.semanticRole).toBe("workflow");
    expect(item?.asset.metadata?.configurationSurface).toEqual(expect.any(Array));
    expect(item?.asset.metadata?.inspectableFields).toContain("sourceImage");
    expect(item?.badges).toContain("restyle");
  });
});
