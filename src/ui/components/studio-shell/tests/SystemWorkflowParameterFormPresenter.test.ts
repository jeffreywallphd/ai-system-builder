import { describe, expect, it } from "bun:test";
import type { StudioImageWorkflowDefinitionReadModel } from "@infrastructure/api/studio-shell/StudioShellBackendApi";
import {
  createWorkflowParameterInitialValues,
  isWorkflowParameterVisible,
  validateWorkflowParameterValues,
} from "../SystemWorkflowParameterFormPresenter";

function createWorkflow(): StudioImageWorkflowDefinitionReadModel {
  return Object.freeze({
    workflowId: "image-template:image-to-image-restyle:v1",
    title: "Image-to-image restyle",
    summary: "Prompt-driven variation.",
    rationale: "Great for guided edits.",
    operationKind: "image-to-image",
    updatedAt: "2026-04-08T00:00:00.000Z",
    version: Object.freeze({
      lineageId: "image-template:image-to-image-restyle",
      versionTag: "v1",
      revision: 1,
    }),
    parameterDefaults: Object.freeze({
      prompt: "Default prompt",
      variationStrength: 0.45,
    }),
    parameterSpecifications: Object.freeze([{
      parameterId: "prompt",
      label: "Edit direction",
      valueKind: "text",
      semanticMeaning: "prompt",
      required: true,
      defaultValue: "Default prompt",
      sensitivity: "normal",
      validation: Object.freeze({
        minLength: 5,
        maxLength: 400,
        options: Object.freeze([]),
        acceptedAssetKinds: Object.freeze([]),
      }),
      ui: Object.freeze({
        control: "text-area",
        order: 0,
        helpText: "Describe visible changes.",
      }),
    }, {
      parameterId: "variationStrength",
      label: "Variation strength",
      valueKind: "float",
      semanticMeaning: "variation-strength",
      required: true,
      defaultValue: 0.45,
      sensitivity: "normal",
      validation: Object.freeze({
        minimum: 0,
        maximum: 1,
        step: 0.05,
        options: Object.freeze([]),
        acceptedAssetKinds: Object.freeze([]),
      }),
      ui: Object.freeze({
        control: "slider",
        order: 1,
      }),
      visibility: Object.freeze({
        mode: "all",
        rules: Object.freeze([{
          parameterId: "prompt",
          operator: "exists",
        }]),
      }),
    }]),
    minimumRequirements: Object.freeze({
      inputKinds: Object.freeze(["source-image"]),
      outputKinds: Object.freeze(["generated-image"]),
      requiredParameterIds: Object.freeze(["prompt", "variationStrength"]),
    }),
  });
}

describe("SystemWorkflowParameterFormPresenter", () => {
  it("hydrates initial values from saved values and defaults", () => {
    const workflow = createWorkflow();
    const values = createWorkflowParameterInitialValues({
      workflow,
      existingValues: Object.freeze({ prompt: "Saved prompt" }),
    });
    expect(values.prompt).toBe("Saved prompt");
    expect(values.variationStrength).toBe(0.45);
  });

  it("evaluates parameter visibility rules", () => {
    const workflow = createWorkflow();
    const variationStrength = workflow.parameterSpecifications[1]!;
    expect(isWorkflowParameterVisible(variationStrength, Object.freeze({ prompt: "hello" }))).toBeTrue();
    expect(isWorkflowParameterVisible(variationStrength, Object.freeze({ prompt: "" }))).toBeFalse();
  });

  it("returns shared-contract validation issues by parameter", () => {
    const workflow = createWorkflow();
    const validation = validateWorkflowParameterValues({
      workflow,
      values: Object.freeze({
        prompt: "abc",
        variationStrength: 2,
      }),
    });
    expect(validation.hasIssues).toBeTrue();
    expect((validation.issuesByParameterId.get("prompt") ?? []).length).toBeGreaterThan(0);
    expect((validation.issuesByParameterId.get("variationStrength") ?? []).length).toBeGreaterThan(0);
  });
});
