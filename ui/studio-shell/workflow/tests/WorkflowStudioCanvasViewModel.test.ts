import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftStepKinds,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  WorkflowCanvasSectionIds,
} from "../WorkflowStudioCanvasViewModel";

describe("WorkflowStudioCanvasViewModel", () => {
  it("projects canonical workflow draft into section-based canvas view model", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([
        Object.freeze({
          id: "trigger-1",
          kind: "user" as const,
          type: "manual" as const,
          title: "Start",
          config: Object.freeze({}),
        }),
      ]),
      inputs: Object.freeze([
        Object.freeze({
          id: "input-1",
          type: "runtime-parameter-input",
          title: "Prompt",
          sourceType: "runtime-parameter" as const,
          parameterKey: "prompt",
          valueType: "string" as const,
          required: true,
        }),
      ]),
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          title: "Plan",
        }),
      ]),
      outputs: Object.freeze([
        Object.freeze({
          id: "output-1",
          type: "workflow-output",
          order: 1,
          title: "Result",
          outputType: "document",
          format: "json",
          destination: Object.freeze({
            type: WorkflowDraftOutputDestinationTypes.webViewer,
            target: "preview",
          }),
        }),
      ]),
    });

    const viewModel = deriveWorkflowCanvasViewModel(draft, []);
    expect(viewModel.sections.map((section) => section.id)).toEqual([
      WorkflowCanvasSectionIds.triggers,
      WorkflowCanvasSectionIds.inputs,
      WorkflowCanvasSectionIds.steps,
      WorkflowCanvasSectionIds.outputs,
    ]);
    expect(viewModel.totalNodeCount).toBe(4);
    expect(viewModel.sections[0]?.nodes[0]?.title).toBe("Start");
    expect(viewModel.sections[1]?.nodes[0]?.title).toBe("Prompt");
    expect(viewModel.sections[2]?.nodes[0]?.title).toBe("Plan");
    expect(viewModel.sections[3]?.nodes[0]?.title).toBe("Result");
  });

  it("applies canvas actions against one shared canonical draft model", () => {
    let draft = createEmptyWorkflowDraft();

    draft = applyWorkflowCanvasAction(draft, { kind: "add-trigger" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-input-runtime-parameter" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-output" }).draft;

    expect(draft.triggers.length).toBe(1);
    expect(draft.inputs.length).toBe(1);
    expect(draft.steps.length).toBe(1);
    expect(draft.outputs.length).toBe(1);

    const triggerId = draft.triggers[0]?.id as string;
    const inputId = draft.inputs[0]?.id as string;
    const stepId = draft.steps[0]?.id as string;
    const outputId = draft.outputs[0]?.id as string;

    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-trigger-title",
      triggerId,
      title: "Canvas trigger",
    }).draft;
    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-input-title",
      inputId,
      title: "Canvas input",
    }).draft;
    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-step-title",
      stepId,
      title: "Canvas step",
    }).draft;
    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-output-title",
      outputId,
      title: "Canvas output",
    }).draft;

    expect(draft.triggers[0]?.title).toBe("Canvas trigger");
    expect(draft.inputs[0]?.title).toBe("Canvas input");
    expect(draft.steps[0]?.title).toBe("Canvas step");
    expect(draft.outputs[0]?.title).toBe("Canvas output");

    draft = applyWorkflowCanvasAction(draft, { kind: "remove-step", stepId }).draft;
    expect(draft.steps).toHaveLength(0);
  });
});
