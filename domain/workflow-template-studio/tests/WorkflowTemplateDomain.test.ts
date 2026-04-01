import { describe, expect, it } from "bun:test";
import {
  createWorkflowTemplateAssetMetadata,
  createWorkflowTemplateDefinition,
  createWorkflowTemplateStudioTaxonomy,
  deserializeWorkflowTemplateDefinition,
  serializeWorkflowTemplateDefinition,
  WorkflowTemplateStudioIdentity,
} from "../WorkflowTemplateDomain";

describe("WorkflowTemplateDomain", () => {
  const definition = {
    templateId: "template:image:cinematic",
    versionId: "template:image:cinematic:v1",
    name: "Cinematic Image Generation",
    summary: "Starter template for cinematic renders.",
    category: "image-generation",
    supportedIntent: "text-to-image",
    inputRequirements: [
      { inputId: "prompt", valueType: "text", required: true },
      { inputId: "seed", valueType: "number", required: false },
    ],
    outputExpectations: [
      { outputId: "images", valueType: "images", description: "Generated images" },
    ],
    parameterDefaults: [
      { parameterId: "steps", value: 30 },
      { parameterId: "guidanceScale", value: 7 },
    ],
    parameters: [
      { parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: 30, validation: { min: 1, max: 100 } },
      { parameterId: "guidanceScale", name: "Guidance", type: "number", required: false, defaultValue: 7 },
    ],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:cinematic", inputIds: ["prompt"], outputIds: ["images"], parameterIds: ["steps", "guidanceScale"] }],
      inputBindings: [{ bindingId: "input-prompt", templateInputId: "prompt", workflowAssetId: "asset:workflow:cinematic", workflowInputId: "prompt" }],
      outputBindings: [{ bindingId: "output-images", templateOutputId: "images", workflowAssetId: "asset:workflow:cinematic", workflowOutputId: "images" }],
      parameterMappings: [{ parameterId: "steps", workflowAssetId: "asset:workflow:cinematic", workflowParameterId: "steps" }],
    },
    workflowAssets: [
      { role: "workflow-definition", assetId: "asset:workflow:cinematic", versionId: "asset:workflow:cinematic:v3" },
      { role: "model", assetId: "asset:model:sdxl", versionId: "asset:model:sdxl:v1" },
    ],
    tags: ["image", "starter", "cinematic", "starter"],
    metadata: { owner: "platform", tier: "starter" },
  } as const;

  it("normalizes and validates workflow template definitions", () => {
    const created = createWorkflowTemplateDefinition(definition);
    expect(created.tags).toEqual(["image", "starter", "cinematic"]);
    expect(created.workflowAssets[0]?.role).toBe("workflow-definition");
  });

  it("round-trips definitions through serialization", () => {
    const serialized = serializeWorkflowTemplateDefinition(definition);
    const reloaded = deserializeWorkflowTemplateDefinition(serialized);
    expect(reloaded.templateId).toBe(definition.templateId);
    expect(reloaded.versionId).toBe(definition.versionId);
    expect(reloaded.outputExpectations[0]?.outputId).toBe("images");
    expect(reloaded.parameters?.[0]?.parameterId).toBe("steps");
    expect(reloaded.composition?.workflowInterfaces[0]?.workflowAssetId).toBe("asset:workflow:cinematic");
  });

  it("requires at least one workflow-definition reference", () => {
    expect(() => createWorkflowTemplateDefinition({
      ...definition,
      workflowAssets: [{ role: "model", assetId: "asset:model:only" }],
    })).toThrow("must reference at least one workflow-definition");
  });


  it("requires unique template parameter ids", () => {
    expect(() => createWorkflowTemplateDefinition({
      ...definition,
      parameters: [
        { parameterId: "steps", name: "Steps", type: "integer", required: true },
        { parameterId: "steps", name: "Steps Again", type: "integer", required: false },
      ],
    })).toThrow("unique parameter ids");
  });

  it("creates composite workflow-template taxonomy + metadata", () => {
    expect(createWorkflowTemplateStudioTaxonomy("conditional")).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow-template",
      behaviorKind: "conditional",
    });

    const metadata = createWorkflowTemplateAssetMetadata({ title: "Starter" });
    expect(metadata.taxonomy?.semanticRole).toBe("workflow-template");
    expect(metadata.provenance?.sourceLabel).toBe(WorkflowTemplateStudioIdentity.studioType);
  });
});
