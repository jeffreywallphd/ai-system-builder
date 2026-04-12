import { describe, expect, it } from "bun:test";
import {
  ImageSystemBindingValidationIssueCodes,
  ImageWorkflowBindingContractVersions,
  ImageWorkflowInputSlotPurposes,
  ImageWorkflowOutputSlotPurposes,
  ImageWorkflowSlotCardinalities,
  createImageSystemBindingContract,
  createImageWorkflowBindingContract,
  validateImageSystemBindingContract,
} from "../ImageWorkflowBindingContracts";

function createWorkflowContract() {
  return createImageWorkflowBindingContract({
    workflowId: "wf:image:binding-1",
    workflowVersionTag: "1.0.0",
    inputSlots: [
      {
        slotId: "sourceImage",
        label: "Source image",
        purpose: ImageWorkflowInputSlotPurposes.sourceImage,
        required: true,
        cardinality: ImageWorkflowSlotCardinalities.one,
        minimumAssetCount: 1,
        allowedAssetClasses: ["image-asset"],
        allowedMediaClasses: ["image/png", "image/jpeg"],
      },
      {
        slotId: "maskImage",
        label: "Mask image",
        purpose: ImageWorkflowInputSlotPurposes.maskImage,
        required: false,
        cardinality: ImageWorkflowSlotCardinalities.one,
        minimumAssetCount: 0,
        allowedAssetClasses: ["mask-asset"],
        allowedMediaClasses: ["image/png"],
      },
      {
        slotId: "referenceImages",
        label: "Reference images",
        purpose: ImageWorkflowInputSlotPurposes.referenceImage,
        required: false,
        cardinality: ImageWorkflowSlotCardinalities.many,
        minimumAssetCount: 0,
        maximumAssetCount: 4,
        allowedAssetClasses: ["image-asset", "reference-asset"],
        allowedMediaClasses: ["image/png", "image/jpeg", "image/webp"],
      },
    ],
    outputSlots: [
      {
        slotId: "images",
        label: "Generated images",
        purpose: ImageWorkflowOutputSlotPurposes.generatedImageCollection,
        required: true,
        cardinality: ImageWorkflowSlotCardinalities.many,
        minimumAssetCount: 1,
        emittedAssetClasses: ["generated-image-asset"],
        emittedMediaClasses: ["image/png", "image/webp"],
      },
    ],
  });
}

describe("ImageWorkflowBindingContracts", () => {
  it("creates workflow binding contracts with required source slots and typed optional mask/reference slots", () => {
    const contract = createWorkflowContract();

    expect(contract.contractVersion).toBe(ImageWorkflowBindingContractVersions.v1);
    expect(contract.inputSlots.map((slot) => slot.slotId)).toEqual(["sourceImage", "maskImage", "referenceImages"]);
    expect(contract.inputSlots.find((slot) => slot.slotId === "maskImage")?.required).toBeFalse();
    expect(contract.outputSlots[0]?.slotId).toBe("images");
  });

  it("rejects workflow binding contracts that do not declare a required source image slot", () => {
    expect(() => createImageWorkflowBindingContract({
      workflowId: "wf:image:no-source",
      workflowVersionTag: "1.0.0",
      inputSlots: [{
        slotId: "referenceOnly",
        label: "Reference",
        purpose: ImageWorkflowInputSlotPurposes.referenceImage,
        required: false,
        cardinality: ImageWorkflowSlotCardinalities.one,
        minimumAssetCount: 0,
        allowedAssetClasses: ["reference-asset"],
        allowedMediaClasses: ["image/png"],
      }],
      outputSlots: [],
    })).toThrow("required source-image");
  });

  it("validates compatible logical system input/output bindings", () => {
    const workflowContract = createWorkflowContract();
    const systemContract = createImageSystemBindingContract({
      systemId: "img-system:binding-1",
      workflowId: workflowContract.workflowId,
      inputBindings: [
        {
          bindingId: "in.source",
          slotId: "sourceImage",
          assets: [{
            assetReferenceId: "asset:image:source-1",
            assetClass: "image-asset",
            mediaClass: "image/png",
          }],
        },
      ],
      outputBindings: [
        {
          bindingId: "out.images",
          slotId: "images",
          targetReference: "dataset-instance://workspace-alpha/generated",
          acceptedAssetClasses: ["generated-image-asset"],
          acceptedMediaClasses: ["image/png"],
        },
      ],
    });

    const result = validateImageSystemBindingContract({ workflowContract, systemContract });
    expect(result.valid).toBeTrue();
    expect(result.issues).toHaveLength(0);
  });

  it("reports missing required slots, unknown slots, cardinality, and compatibility issues", () => {
    const workflowContract = createWorkflowContract();
    const systemContract = createImageSystemBindingContract({
      systemId: "img-system:binding-2",
      workflowId: "wf:image:other",
      inputBindings: [
        {
          bindingId: "in.reference",
          slotId: "referenceImages",
          assets: [
            {
              assetReferenceId: "asset:image:ref-1",
              assetClass: "reference-asset",
              mediaClass: "image/webp",
            },
            {
              assetReferenceId: "asset:image:ref-2",
              assetClass: "reference-asset",
              mediaClass: "image/webp",
            },
            {
              assetReferenceId: "asset:image:ref-3",
              assetClass: "reference-asset",
              mediaClass: "image/webp",
            },
            {
              assetReferenceId: "asset:image:ref-4",
              assetClass: "reference-asset",
              mediaClass: "image/webp",
            },
            {
              assetReferenceId: "asset:image:ref-5",
              assetClass: "reference-asset",
              mediaClass: "image/webp",
            },
          ],
        },
        {
          bindingId: "in.unknown",
          slotId: "unknownInput",
          assets: [{
            assetReferenceId: "asset:image:x",
            assetClass: "image-asset",
            mediaClass: "image/png",
          }],
        },
      ],
      outputBindings: [
        {
          bindingId: "out.unknown",
          slotId: "unknownOutput",
          targetReference: "dataset-instance://workspace-alpha/generated",
          acceptedAssetClasses: ["generated-image-asset"],
          acceptedMediaClasses: ["image/png"],
        },
        {
          bindingId: "out.images",
          slotId: "images",
          targetReference: "dataset-instance://workspace-alpha/generated",
          acceptedAssetClasses: ["non-generated-asset"],
          acceptedMediaClasses: ["image/gif"],
        },
      ],
    });

    const result = validateImageSystemBindingContract({ workflowContract, systemContract });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.workflowMismatch)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.requiredInputBindingMissing)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.requiredOutputBindingMissing)).toBeFalse();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.unknownInputSlot)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.unknownOutputSlot)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.inputCardinalityOverflow)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.outputAssetClassIncompatible)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemBindingValidationIssueCodes.outputMediaClassIncompatible)).toBeTrue();
  });

  it("rejects filesystem-path style logical references", () => {
    const workflowContract = createWorkflowContract();

    expect(() => createImageSystemBindingContract({
      systemId: "img-system:path-ref",
      workflowId: workflowContract.workflowId,
      inputBindings: [{
        bindingId: "in.source",
        slotId: "sourceImage",
        assets: [{
          assetReferenceId: "C:\\temp\\source.png",
          assetClass: "image-asset",
        }],
      }],
      outputBindings: [],
    })).toThrow("logical reference");
  });
});
