import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "@domain/system-studio/SystemContextContract";
import { validateReferenceImageCrossStudioContext } from "../ReferenceImageCrossStudioIntegrity";

describe("ReferenceImageCrossStudioIntegrity", () => {
  it("accepts valid runtime context with required input and output references", () => {
    const result = validateReferenceImageCrossStudioContext(createSystemContextContract({
      selectedImages: [{
        selectionId: "sel-1",
        imageId: "record-1",
        assetRef: { assetId: "asset:image:1", recordId: "record-1" },
        metadata: { format: "png" },
      }],
      parameters: {
        editInstruction: "warm highlights",
        resultCount: 1,
      },
      datasets: [{
        referenceId: "active-input",
        instanceId: "dataset-instance:reference-image:input",
        datasetAssetId: "asset:dataset:image-reference-input",
        role: "active-input",
        metadata: {
          schemaIntentId: "media",
          sampleRecordValue: { assetRef: { assetId: "asset:image:1" } },
        },
      }, {
        referenceId: "system-output",
        instanceId: "dataset-instance:reference-image:output",
        datasetAssetId: "asset:dataset:image-reference-output",
        role: "system-owned-output",
      }],
    }), { executionId: "run:1" });

    expect(result.valid).toBeTrue();
    expect(result.blockingIssues).toHaveLength(0);
  });

  it("reports blocking issues for missing selection, unresolved dataset instance, and missing output target", () => {
    const result = validateReferenceImageCrossStudioContext(createSystemContextContract({
      selectedImages: [],
      parameters: {},
      datasets: [{
        referenceId: "active-input",
        datasetAssetId: "asset:dataset:image-reference-input",
        role: "active-input",
      }],
    }), { executionId: "run:broken" });

    expect(result.valid).toBeFalse();
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("selected-image-missing");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("dataset-reference-unresolved");
    expect(result.warningIssues.map((issue) => issue.code)).toContain("output-target-missing");
  });
});

