import { describe, expect, it } from "bun:test";
import {
  WorkflowTemplateAssetSelectorAdapter,
  createWorkflowTemplateAssetSelectorRequest,
} from "../WorkflowTemplateAssetSelectorAdapter";

describe("WorkflowTemplateAssetSelectorAdapter", () => {
  it("builds workflow-template typed selector requests", () => {
    const request = createWorkflowTemplateAssetSelectorRequest({
      requestId: "selector:workflow-template",
      originatingStudio: "workflow-studio",
      originatingField: "templates",
      usageContext: "workflow-template",
    });

    expect(request.assetType).toBe("workflow-template");
    expect(request.context.usageContext).toBe("workflow-template");
  });

  it("lists starter workflow templates with metadata and category badges", async () => {
    const request = createWorkflowTemplateAssetSelectorRequest({
      requestId: "selector:workflow-template",
      originatingStudio: "workflow-studio",
      originatingField: "templates",
    });

    const response = await new WorkflowTemplateAssetSelectorAdapter().query({ request, searchTerm: "enhance" });
    expect(response.items.length).toBe(1);
    expect(response.items[0]?.asset.assetType).toBe("workflow-template");
    expect(response.items[0]?.badges).toContain("enhancement");
  });
});
