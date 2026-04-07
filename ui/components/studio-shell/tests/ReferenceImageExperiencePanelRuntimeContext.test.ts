import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "../../../../src/domain/system-studio/SystemContextContract";
import {
  persistReferenceImageRuntimeContext,
  readStoredReferenceImageRuntimeContext,
} from "../ReferenceImageExperiencePanel";

describe("ReferenceImageExperiencePanel runtime context persistence", () => {
  it("round-trips shared runtime context in system draft content", () => {
    const content = JSON.stringify({ systemSpec: { inputs: [] } });
    const persisted = persistReferenceImageRuntimeContext(content, {
      selectedRecordId: "record:1",
      selectedAssetId: "asset:image:1",
      editInstruction: "Brighten sky",
      variationStrength: 0.4,
      resultCount: 2,
      runtimeContext: createSystemContextContract({
        selectedImages: [{
          selectionId: "record:1",
          imageId: "record:1",
          assetRef: {
            assetId: "asset:image:1",
            recordId: "record:1",
          },
        }],
        parameters: { editInstruction: "Brighten sky", variationStrength: 0.4, resultCount: 2 },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:input",
          datasetAssetId: "asset:dataset:in",
          role: "active-input",
        }],
        runtime: {
          runtimeSessionId: "session:1",
          systemAssetId: "asset:system:reference-image-manipulation",
          workflowAssetId: "asset:workflow-template:image-to-image:starter",
          sourceStudio: "system-studio",
        },
      }),
    });

    const loaded = readStoredReferenceImageRuntimeContext(persisted);
    expect(loaded?.selectedRecordId).toBe("record:1");
    expect(loaded?.runtimeContext.selectedImages[0]?.assetRef?.assetId).toBe("asset:image:1");
    expect(loaded?.runtimeContext.datasets[0]?.instanceId).toBe("dataset-instance:input");
    expect(loaded?.runtimeContext.parameters.resultCount).toBe(2);
  });
});
