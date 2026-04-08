import { describe, expect, it } from "bun:test";
import {
  normalizeImageWorkflowParameterSpecification,
  validateImageWorkflowParameterValue,
} from "../ImageWorkflowParameterSpecification";

describe("ImageWorkflowParameterSpecification", () => {
  it("normalizes typed specs with validation and ui hints", () => {
    const specification = normalizeImageWorkflowParameterSpecification({
      parameterId: "referenceStyle",
      label: "Reference style",
      valueKind: "reference-asset-reference",
      semanticMeaning: "style-reference",
      required: false,
      sensitivity: "normal",
      validation: {
        acceptedAssetKinds: ["image-asset", "image-asset"],
      },
      ui: {
        control: "reference-slot",
        group: "Reference",
        order: 2,
      },
      visibility: {
        mode: "all",
        rules: [{ parameterId: "editMode", operator: "equals", value: "guided" }],
      },
    });

    expect(specification.validation.acceptedAssetKinds).toEqual(["image-asset"]);
    expect(specification.ui.group).toBe("Reference");
  });

  it("rejects incompatible validation and ui combinations", () => {
    expect(() => normalizeImageWorkflowParameterSpecification({
      parameterId: "flag",
      label: "Flag",
      valueKind: "boolean",
      semanticMeaning: "custom",
      required: false,
      sensitivity: "normal",
      validation: {
        minimum: 0,
      },
      ui: {
        control: "switch",
      },
    })).toThrow("numeric bounds");

    expect(() => normalizeImageWorkflowParameterSpecification({
      parameterId: "count",
      label: "Count",
      valueKind: "integer",
      semanticMeaning: "output-count",
      required: true,
      sensitivity: "normal",
      validation: {
        minimum: 1,
        maximum: 4,
        step: 1,
      },
      ui: {
        control: "select",
      },
    })).toThrow("ui.control");
  });

  it("validates parameter values against type, range, and enum constraints", () => {
    const specification = normalizeImageWorkflowParameterSpecification({
      parameterId: "resultCount",
      label: "Result count",
      valueKind: "integer",
      semanticMeaning: "output-count",
      required: true,
      defaultValue: 1,
      sensitivity: "normal",
      validation: {
        minimum: 1,
        maximum: 4,
        step: 1,
      },
      ui: {
        control: "number-input",
      },
    });

    expect(validateImageWorkflowParameterValue(specification, 3)).toEqual([]);
    expect(validateImageWorkflowParameterValue(specification, 0).length).toBeGreaterThan(0);
    expect(validateImageWorkflowParameterValue(specification, 1.5).length).toBeGreaterThan(0);
  });
});
