import { describe, expect, it } from "bun:test";
import {
  buildAssetContractForImageWorkflowIntent,
  CoreImageWorkflowAssetTypeContracts,
  createImageWorkflowAssetContract,
  ImageWorkflowAssetIntentTypes,
  listCoreImageWorkflowAssetTypeContracts,
} from "../ImageWorkflowAssetContract";

describe("ImageWorkflowAssetContract", () => {
  it("defines the four high-level core image workflow asset intents", () => {
    const entries = listCoreImageWorkflowAssetTypeContracts();
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.identity.intentType).sort()).toEqual([
      "batch-transform",
      "enhance-upscale",
      "image-to-image",
      "restyle",
    ]);
  });

  it("keeps contracts high-level and adapter-bounded", () => {
    const restyle = CoreImageWorkflowAssetTypeContracts[ImageWorkflowAssetIntentTypes.restyle];
    expect(restyle.composition.adapterBoundary.adapterId).toBe("image-workflow-execution-adapter");
    expect(restyle.input.fields.some((field) => field.id.includes("node"))).toBeFalse();
    expect(restyle.intendedUse.toLowerCase()).not.toContain("comfyui");
  });

  it("validates and freezes custom image workflow asset contract payloads", () => {
    const custom = createImageWorkflowAssetContract({
      identity: {
        assetKind: "workflow-asset",
        assetType: "image-workflow",
        intentType: "image-to-image",
      },
      intendedUse: "Create product shot variations from an input image.",
      version: { contractVersion: "1.0.0", revision: 1 },
      input: {
        fields: [
          { id: "sourceImage", description: "input", valueType: "image-asset-reference", required: true },
        ],
      },
      output: {
        fields: [
          { id: "images", description: "results", valueType: "image-asset-reference[]", required: true, allowsMultiple: true },
        ],
      },
      config: {
        fields: [
          { id: "variationStrength", description: "strength", valueType: "number", defaultValue: 0.4 },
        ],
      },
      preview: {
        mode: "comparison",
        inspectableFields: ["sourceImage", "images"],
      },
      composition: {
        adapterBoundary: { adapterId: "image-workflow-execution-adapter", contractVersion: "1.0.0" },
      },
    });

    expect(Object.isFrozen(custom)).toBeTrue();
    expect(custom.input.fields[0]?.id).toBe("sourceImage");
  });

  it("projects core intent contracts into shared asset contract descriptors", () => {
    const descriptor = buildAssetContractForImageWorkflowIntent(ImageWorkflowAssetIntentTypes.batchTransform);
    expect(descriptor.parameters.find((parameter) => parameter.id === "concurrency")?.defaultValue).toBe(4);
    expect(descriptor.execution?.invocationMode).toBe("async");
    expect((descriptor.input?.schema as { required?: string[] }).required).toContain("batchItems");
  });
});
