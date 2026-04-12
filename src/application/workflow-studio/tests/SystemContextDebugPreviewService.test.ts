import { describe, expect, it } from "bun:test";
import { SystemContextDebugPreviewService } from "../SystemContextDebugPreviewService";

describe("SystemContextDebugPreviewService", () => {
  it("builds inspectable context pipeline results from System Studio source state", () => {
    const service = new SystemContextDebugPreviewService();
    const result = service.preview({
      source: {
        selectedImages: [{
          selectionId: "selection-1",
          imageId: "image-1",
          assetRef: { assetId: "asset-image-1" },
          metadata: { width: 1024 },
        }],
        parameterValues: { prompt: "repair", strength: 0.8 },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance-1",
          datasetAssetId: "dataset:images",
          role: "active-input",
          metadata: { schemaIntentId: "media-input" },
        }],
        runtime: {
          runtimeSessionId: "runtime-1",
          workflowAssetId: "workflow-1",
          sourceStudio: "system-studio",
        },
      },
    });

    expect(result.context.parameters.prompt).toBe("repair");
    expect(result.validation.valid).toBe(true);
    expect(result.datasetResolution.resolved).toHaveLength(1);
    expect((result.workflowContext.metadata as { datasetResolution: { resolvedCount: number } }).datasetResolution.resolvedCount).toBe(1);
    expect((result.enrichedTriggerPayload as { systemContext: { runtime: { runtimeSessionId: string } } }).systemContext.runtime.runtimeSessionId).toBe("runtime-1");
  });
});
