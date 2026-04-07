import { describe, expect, it } from "bun:test";
import {
  buildWorkflowDatasetCompatibilityContract,
  WorkflowMediaImageStableFieldKeys,
} from "../WorkflowDatasetCompatibilityContracts";

describe("WorkflowDatasetCompatibilityContracts", () => {
  it("builds generic dataset-reference contracts for non-media datasets", () => {
    const contract = buildWorkflowDatasetCompatibilityContract({
      assetId: "asset:dataset:tabular",
      versionId: "1.2.0",
      selection: {
        split: "train",
      },
    });

    expect(contract).toEqual({
      kind: "dataset-reference",
      contractVersion: "1.0.0",
      assetRef: {
        assetId: "asset:dataset:tabular",
        versionId: "1.2.0",
      },
    });
  });

  it("builds media compatibility contracts with stable canonical image record fields", () => {
    const contract = buildWorkflowDatasetCompatibilityContract({
      assetId: "asset:dataset:images",
      versionId: "2.0.0",
      selection: {
        schemaIntentId: "media",
        shapeKind: "image-metadata-records",
        fields: ["assetRef", "width", "height", "thumbnailSource", "format"],
      },
    });

    expect(contract?.kind).toBe("media-image-records");
    if (!contract || contract.kind !== "media-image-records") {
      throw new Error("Expected media-image-records compatibility contract.");
    }

    expect(contract.recordContract.id).toBe("image-record");
    expect(contract.recordContract.version).toBe("1.1.0");
    expect(contract.stableFieldKeys).toEqual([...WorkflowMediaImageStableFieldKeys]);
    expect(contract.selectedFieldKeys).toEqual(["assetRef", "width", "height", "format"]);
    expect(contract.stableFieldKeys.includes("thumbnailSource")).toBeFalse();
  });
});
