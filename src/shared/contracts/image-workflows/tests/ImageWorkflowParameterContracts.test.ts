import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowParameterContractVersions,
  ImageSystemParameterValidationIssueCodes,
  createImageWorkflowParameterDefinitionContract,
  validateImageSystemParameterSetContract,
} from "../ImageWorkflowParameterContracts";

describe("ImageWorkflowParameterContracts", () => {
  const parameterSpecifications = [
    {
      parameterId: "editInstruction",
      label: "Edit instruction",
      valueKind: "text",
      semanticMeaning: "prompt",
      required: true,
      sensitivity: "normal",
      validation: {
        minLength: 3,
        maxLength: 280,
      },
      ui: {
        control: "text-area",
        placeholder: "Describe the desired edit.",
      },
    },
    {
      parameterId: "variationStrength",
      label: "Variation strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      defaultValue: 0.5,
      sensitivity: "normal",
      validation: {
        minimum: 0,
        maximum: 1,
        step: 0.05,
      },
      ui: {
        control: "slider",
        unitLabel: "%",
      },
    },
    {
      parameterId: "maskAsset",
      label: "Mask slot",
      valueKind: "mask-asset-reference",
      semanticMeaning: "mask-reference",
      required: false,
      sensitivity: "sensitive",
      validation: {
        acceptedAssetKinds: ["mask-image", "mask-image"],
      },
      ui: {
        control: "mask-slot",
      },
    },
  ] as const;

  it("creates workflow parameter definition contracts with normalized specifications", () => {
    const contract = createImageWorkflowParameterDefinitionContract({
      workflowId: "wf:image:1",
      workflowVersionTag: "1.0.0",
      specification: parameterSpecifications[2],
    });

    expect(contract.contractVersion).toBe(ImageWorkflowParameterContractVersions.v1);
    expect(contract.specification.validation.acceptedAssetKinds).toEqual(["mask-image"]);
  });

  it("validates image system parameter value sets against workflow parameter specs", () => {
    const result = validateImageSystemParameterSetContract({
      parameterSpecifications,
      values: [
        { parameterId: "editInstruction", value: "Increase contrast", source: "baseline" },
        { parameterId: "variationStrength", value: 0.6, source: "runtime-override" },
      ],
    });

    expect(result.valid).toBeTrue();
    expect(result.issues).toHaveLength(0);
  });

  it("reports unknown parameters, missing required values, and invalid parameter values", () => {
    const result = validateImageSystemParameterSetContract({
      parameterSpecifications,
      values: [
        { parameterId: "variationStrength", value: 2, source: "baseline" },
        { parameterId: "unknown", value: true, source: "baseline" },
      ],
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === ImageSystemParameterValidationIssueCodes.requiredValueMissing)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemParameterValidationIssueCodes.invalidValue)).toBeTrue();
    expect(result.issues.some((issue) => issue.code === ImageSystemParameterValidationIssueCodes.unknownParameter)).toBeTrue();
  });
});
