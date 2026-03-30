import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  WorkflowCanvasGraphEdgeKinds,
  WorkflowCanvasGraphNodeKinds,
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

    const graphSectionNode = viewModel.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.section
      && node.sectionId === WorkflowCanvasSectionIds.triggers
    ));
    const graphItemNode = viewModel.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
      && node.title === "Plan"
    ));

    expect(graphSectionNode).toBeDefined();
    expect(graphItemNode).toBeDefined();
    expect(viewModel.graph.edges.some((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.sectionFlow)).toBe(true);
    expect(viewModel.graph.edges.some((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.itemSequence)).toBe(false);
  });

  it("derives deterministic canvas placement and explicit section-flow edges", () => {
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
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          title: "First",
        }),
        Object.freeze({
          id: "step-2",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
          title: "Second",
        }),
      ]),
    });

    const viewModel = deriveWorkflowCanvasViewModel(draft, []);
    const stepNodes = viewModel.graph.nodes.filter((node) => node.sectionId === WorkflowCanvasSectionIds.steps);
    expect(stepNodes.map((node) => node.position.y)).toEqual([0, 156, 332]);
    expect(stepNodes[0]?.kind).toBe(WorkflowCanvasGraphNodeKinds.section);
    expect(stepNodes[1]?.kind).toBe(WorkflowCanvasGraphNodeKinds.item);
    expect(stepNodes[2]?.kind).toBe(WorkflowCanvasGraphNodeKinds.item);
    expect(viewModel.graph.edges.some((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.itemSequence)).toBe(true);
    expect(viewModel.graph.edges.some((edge) => (
      edge.kind === WorkflowCanvasGraphEdgeKinds.sectionFlow
      && edge.id.includes("triggers")
      && edge.id.includes("inputs")
    ))).toBe(true);
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

  it("adds palette-mapped input and step variants through shared canvas actions", () => {
    let draft = createEmptyWorkflowDraft();

    draft = applyWorkflowCanvasAction(draft, { kind: "add-input-dataset-asset" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-input-static-value" }).draft;
    draft = applyWorkflowCanvasAction(draft, {
      kind: "add-step",
      definitionKey: "built-in:control-flow:if-then",
    }).draft;

    expect(draft.inputs).toHaveLength(2);
    expect(draft.inputs[0]?.sourceType).toBe("dataset-asset");
    expect(draft.inputs[1]?.sourceType).toBe("static-value");
    expect(draft.steps).toHaveLength(1);
    expect(draft.steps[0]?.type).not.toBe(WorkflowDraftStepTypes.agentAssistant);
  });
});
