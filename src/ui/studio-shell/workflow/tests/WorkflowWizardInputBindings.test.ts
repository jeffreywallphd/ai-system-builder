import { describe, expect, it } from "bun:test";
import { deserializeWorkflowDraft, serializeWorkflowDraft } from "@domain/workflow-studio/WorkflowStudioDomain";
import { WorkflowInputBindingSourceKinds } from "@domain/workflow-studio/WorkflowInputBindingDomain";
import {
  createDefaultBindingSource,
  createSingleSourceBinding,
  listWorkflowInputBindings,
  removeWorkflowInputBinding,
  upsertWorkflowInputBinding,
} from "../WorkflowWizardInputBindings";

const baseDraft = deserializeWorkflowDraft(`{
  "schemaVersion":"1.0.0",
  "triggers":[],
  "inputs":[
    {"id":"sourceImage","type":"runtime-input","sourceType":"runtime-parameter","required":true,"valueType":"object","parameterKey":"sourceImage"},
    {"id":"stylePreset","type":"runtime-input","sourceType":"runtime-parameter","required":false,"valueType":"string","parameterKey":"stylePreset"}
  ],
  "steps":[],
  "outputs":[]
}`);

describe("WorkflowWizardInputBindings", () => {
  it("persists authored binding metadata through serialize/deserialize", () => {
    const descriptor = createSingleSourceBinding({
      inputId: "sourceImage",
      required: true,
      valueType: "object",
      source: createDefaultBindingSource({ inputId: "sourceImage", kind: WorkflowInputBindingSourceKinds.selectedImage }),
    });
    const nextDraft = upsertWorkflowInputBinding(baseDraft, descriptor);
    const roundTripped = deserializeWorkflowDraft(serializeWorkflowDraft(nextDraft));
    const bindings = listWorkflowInputBindings(roundTripped);

    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.inputId).toBe("sourceImage");
    expect(bindings[0]?.sources[0]?.kind).toBe(WorkflowInputBindingSourceKinds.selectedImage);
  });

  it("supports constants and dataset instance references via reusable defaults", () => {
    const constantBinding = createSingleSourceBinding({
      inputId: "stylePreset",
      valueType: "string",
      source: createDefaultBindingSource({ inputId: "stylePreset", kind: WorkflowInputBindingSourceKinds.constantValue, reference: "cinematic" }),
    });
    const datasetBinding = createSingleSourceBinding({
      inputId: "sourceImage",
      required: true,
      valueType: "object",
      source: createDefaultBindingSource({ inputId: "sourceImage", kind: WorkflowInputBindingSourceKinds.datasetInstanceReference, reference: "active-input" }),
    });
    const withConstant = upsertWorkflowInputBinding(baseDraft, constantBinding);
    const withBoth = upsertWorkflowInputBinding(withConstant, datasetBinding);
    const bindings = listWorkflowInputBindings(withBoth);

    expect(bindings).toHaveLength(2);
    expect(bindings.find((entry) => entry.inputId === "stylePreset")?.sources[0]?.kind).toBe("constant-value");
    expect(bindings.find((entry) => entry.inputId === "sourceImage")?.sources[0]?.kind).toBe("dataset-instance-reference");
  });

  it("removes authored binding metadata without mutating other metadata", () => {
    const descriptor = createSingleSourceBinding({
      inputId: "stylePreset",
      source: createDefaultBindingSource({ inputId: "stylePreset", kind: WorkflowInputBindingSourceKinds.runtimeParameter }),
    });
    const drafted = upsertWorkflowInputBinding(baseDraft, descriptor);
    const removed = removeWorkflowInputBinding(drafted, "stylePreset");

    expect(listWorkflowInputBindings(removed)).toHaveLength(0);
  });
});

