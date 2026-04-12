import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SystemWorkflowParameterForm from "../SystemWorkflowParameterForm";
import type { StudioImageWorkflowDefinitionReadModel } from "@infrastructure/api/studio-shell/StudioShellBackendApi";

function createWorkflow(): StudioImageWorkflowDefinitionReadModel {
  return Object.freeze({
    workflowId: "image-template:mask-guided-edit:v1",
    title: "Mask-guided edit",
    summary: "Localized edits with mask control.",
    rationale: "Targeted image editing workflow.",
    operationKind: "mask-guided-edit",
    updatedAt: "2026-04-08T00:00:00.000Z",
    version: Object.freeze({
      lineageId: "image-template:mask-guided-edit",
      versionTag: "v1",
      revision: 1,
    }),
    parameterDefaults: Object.freeze({
      prompt: "Retouch the masked area only.",
      preserveUnmaskedAreas: true,
    }),
    parameterSpecifications: Object.freeze([{
      parameterId: "prompt",
      label: "Masked edit direction",
      valueKind: "text",
      semanticMeaning: "prompt",
      required: true,
      defaultValue: "Retouch the masked area only.",
      sensitivity: "normal",
      validation: Object.freeze({
        minLength: 5,
        maxLength: 800,
        options: Object.freeze([]),
        acceptedAssetKinds: Object.freeze([]),
      }),
      ui: Object.freeze({
        control: "text-area",
        order: 0,
        helpText: "Describe only the masked-region changes.",
      }),
    }, {
      parameterId: "preserveUnmaskedAreas",
      label: "Protect unmasked areas",
      valueKind: "boolean",
      semanticMeaning: "custom",
      required: false,
      defaultValue: true,
      sensitivity: "normal",
      validation: Object.freeze({
        options: Object.freeze([]),
        acceptedAssetKinds: Object.freeze([]),
      }),
      ui: Object.freeze({
        control: "switch",
        order: 1,
        helpText: "Keep enabled for targeted edits.",
      }),
    }, {
      parameterId: "seed",
      label: "Seed override",
      valueKind: "integer",
      semanticMeaning: "seed",
      required: false,
      defaultValue: 0,
      sensitivity: "normal",
      validation: Object.freeze({
        minimum: 0,
        maximum: 2147483647,
        step: 1,
        options: Object.freeze([]),
        acceptedAssetKinds: Object.freeze([]),
      }),
      ui: Object.freeze({
        control: "number-input",
        group: "advanced generation",
        order: 2,
        advanced: true,
      }),
    }]),
    minimumRequirements: Object.freeze({
      inputKinds: Object.freeze(["source-image", "mask-image"]),
      outputKinds: Object.freeze(["generated-image"]),
      requiredParameterIds: Object.freeze(["prompt"]),
    }),
  });
}

describe("SystemWorkflowParameterForm", () => {
  it("renders typed controls and validation feedback", () => {
    const html = renderToStaticMarkup(
      <SystemWorkflowParameterForm
        workflow={createWorkflow()}
        values={Object.freeze({
          prompt: "abc",
          preserveUnmaskedAreas: true,
        })}
        validation={Object.freeze({
          issuesByParameterId: new Map([[
            "prompt",
            Object.freeze([{
              code: "invalid-value",
              parameterId: "prompt",
              message: "Prompt must be at least 5 characters.",
            }]),
          ]]),
          globalIssues: Object.freeze([]),
          hasIssues: true,
        })}
        onValueChanged={() => {}}
        onSaveRequested={() => {}}
      />,
    );

    expect(html).toContain("Operation settings");
    expect(html).toContain("Core settings");
    expect(html).toContain("Masked edit direction");
    expect(html).toContain("Protect unmasked areas");
    expect(html).toContain("Default: Retouch the masked area only.");
    expect(html).toContain("Advanced options");
    expect(html).toContain("Seed override");
    expect(html).toContain("Save operation settings");
    expect(html).toContain("Prompt must be at least 5 characters.");
  });
});
