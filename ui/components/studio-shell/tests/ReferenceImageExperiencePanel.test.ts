import { describe, expect, it } from "bun:test";
import { buildReferenceImageStartRequest } from "../ReferenceImageExperiencePanel";
import { createSystemContextContract } from "../../../../domain/system-studio/SystemContextContract";

describe("ReferenceImageExperiencePanel", () => {
  it("builds system-start context from UI trigger mapping with selected image and settings", () => {
    const request = buildReferenceImageStartRequest({
      studioId: "studio-system",
      draftId: "draft-system",
      systemAssetId: "asset:system:reference-image-manipulation",
      runtimeContext: createSystemContextContract({
        selectedImages: [{
          selectionId: "record:image-1",
          imageId: "record:image-1",
          assetRef: {
            assetId: "generated-output:upload://demo",
            recordId: "record:image-1",
          },
        }],
        parameters: {
          editInstruction: "add a watercolor style",
          variationStrength: 0.65,
          resultCount: 2,
        },
        datasets: [{
          referenceId: "active-input",
          instanceId: "dataset-instance:reference-image:input",
          datasetAssetId: "asset:dataset:image-reference-input",
          role: "active-input",
        }],
      }),
    });

    expect(request.context.inputValues.sourceImage).toBe("generated-output:upload://demo");
    expect(request.context.inputValues.instruction).toBe("add a watercolor style");
    expect(request.context.inputValues.variationStrength).toBe(0.65);
    expect(request.context.inputValues.resultCount).toBe(2);
    const refs = request.context.metadata?.systemDatasetInstanceRefs as ReadonlyArray<Record<string, unknown>>;
    expect(refs[0]?.instanceId).toBe("dataset-instance:reference-image:input");
  });
});
