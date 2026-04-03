import { describe, expect, it } from "bun:test";
import {
  createTemplateParameterSchema,
  createWorkflowTemplateComposition,
  createWorkflowTemplateParameterDefinition,
} from "../WorkflowTemplateCompositionDomain";

describe("WorkflowTemplateCompositionDomain", () => {
  it("creates inspectable template composition", () => {
    const composition = createWorkflowTemplateComposition({
      workflowInterfaces: [{
        workflowAssetId: "asset:workflow:base",
        inputIds: ["prompt"],
        outputIds: ["images"],
        parameterIds: ["steps"],
      }],
      inputBindings: [{
        bindingId: "input-1",
        templateInputId: "prompt",
        workflowAssetId: "asset:workflow:base",
        workflowInputId: "prompt",
      }],
      outputBindings: [{
        bindingId: "output-1",
        templateOutputId: "images",
        workflowAssetId: "asset:workflow:base",
        workflowOutputId: "images",
        targetDatasetAssetId: "asset:dataset:images",
      }],
      parameterMappings: [{
        parameterId: "steps",
        workflowAssetId: "asset:workflow:base",
        workflowParameterId: "steps",
      }],
    });

    expect(composition.contractVersion).toBe("1.0.0");
    expect(composition.workflowInterfaces[0]?.workflowAssetId).toBe("asset:workflow:base");
  });

  it("validates parameter definitions with zod-aware defaults", () => {
    const parameter = createWorkflowTemplateParameterDefinition({
      parameterId: "steps",
      name: "Steps",
      type: "integer",
      required: true,
      defaultValue: 24,
      validation: { min: 1, max: 100 },
    });

    const schema = createTemplateParameterSchema([parameter]);
    expect(schema.parse({ steps: 20 }).steps).toBe(20);
    expect(() => createWorkflowTemplateParameterDefinition({
      parameterId: "cfg",
      name: "CFG",
      type: "number",
      defaultValue: "bad",
    })).toThrow("invalid");
  });

  it("enforces advanced composition and parameter validation constraints", () => {
    expect(() => createWorkflowTemplateComposition({
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:base" }, { workflowAssetId: "asset:workflow:base" }],
      inputBindings: [],
      outputBindings: [],
      parameterMappings: [],
    })).toThrow("duplicate workflow interfaces");

    expect(() => createWorkflowTemplateParameterDefinition({
      parameterId: "quality",
      name: "Quality",
      type: "enum",
      required: false,
    })).toThrow("requires at least one enum value");

    expect(() => createWorkflowTemplateParameterDefinition({
      parameterId: "prompt",
      name: "Prompt",
      type: "string",
      validation: { minLength: 20, maxLength: 10 },
    })).toThrow("invalid length validation range");

    expect(() => createWorkflowTemplateParameterDefinition({
      parameterId: "mode",
      name: "Mode",
      type: "enum",
      validation: { enumValues: ["basic", "advanced"] },
      dependencyRules: [{ kind: "requires-when-set", parameterId: "mode" }],
    })).toThrow("cannot depend on itself");
  });
});
