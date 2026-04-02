import { describe, expect, it } from "bun:test";
import { buildReferenceImageStartRequest } from "../ReferenceImageExperiencePanel";

describe("ReferenceImageExperiencePanel", () => {
  it("builds system-start context from UI trigger mapping with selected image and settings", () => {
    const request = buildReferenceImageStartRequest({
      studioId: "studio-system",
      draftId: "draft-system",
      systemAssetId: "asset:system:reference-image-manipulation",
      datasetInstanceId: "dataset-instance:reference-image:input",
      selectedRecordId: "record:image-1",
      selectedAssetId: "generated-output:upload://demo",
      editInstruction: "add a watercolor style",
      variationStrength: 0.65,
      resultCount: 2,
    });

    expect(request.context.inputValues.sourceImage).toBe("generated-output:upload://demo");
    expect(request.context.inputValues.instruction).toBe("add a watercolor style");
    expect(request.context.inputValues.variationStrength).toBe(0.65);
    expect(request.context.inputValues.resultCount).toBe(2);
    const refs = request.context.metadata?.systemDatasetInstanceRefs as ReadonlyArray<Record<string, unknown>>;
    expect(refs[0]?.instanceId).toBe("dataset-instance:reference-image:input");
  });
});
