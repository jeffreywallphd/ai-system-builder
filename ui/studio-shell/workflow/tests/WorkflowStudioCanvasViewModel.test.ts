import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftStepTypes,
  createEmptyWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasConnection,
  applyWorkflowCanvasEdgeReconnect,
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  resolveWorkflowCanvasConnectionAction,
  resolveWorkflowCanvasEdgeRemovalAction,
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
    expect(stepNodes[0]?.position.y).toBe(0);
    expect(stepNodes[0]?.kind).toBe(WorkflowCanvasGraphNodeKinds.section);
    expect(stepNodes[1]?.kind).toBe(WorkflowCanvasGraphNodeKinds.item);
    expect(stepNodes[2]?.kind).toBe(WorkflowCanvasGraphNodeKinds.item);
    const gap = viewModel.graph.layout.nodeVerticalGap;
    for (let index = 1; index < stepNodes.length; index += 1) {
      const previous = stepNodes[index - 1];
      const current = stepNodes[index];
      const previousHeight = previous?.height ?? 0;
      expect(current?.position.y).toBeGreaterThanOrEqual((previous?.position.y ?? 0) + previousHeight + gap);
    }
    expect(viewModel.graph.edges.some((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.itemSequence)).toBe(true);
    expect(viewModel.graph.edges.some((edge) => (
      edge.kind === WorkflowCanvasGraphEdgeKinds.sectionFlow
      && edge.id.includes("triggers")
      && edge.id.includes("inputs")
    ))).toBe(true);
  });

  it("calculates node heights and keeps section item spacing non-overlapping", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      steps: Object.freeze([
        Object.freeze({
          id: "step-1",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 1,
          title: "Step with long details",
        }),
        Object.freeze({
          id: "step-2",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
          title: "Next step",
        }),
      ]),
    });

    const viewModel = deriveWorkflowCanvasViewModel(draft, []);
    const stepNodes = viewModel.graph.nodes.filter((node) => (
      node.sectionId === WorkflowCanvasSectionIds.steps
      && node.kind === WorkflowCanvasGraphNodeKinds.item
    ));

    expect(stepNodes).toHaveLength(2);
    const firstNode = stepNodes[0]!;
    const secondNode = stepNodes[1]!;
    const gap = viewModel.graph.layout.nodeVerticalGap;
    expect(firstNode.height).toBeGreaterThanOrEqual(viewModel.graph.layout.itemNodeHeight);
    expect(secondNode.position.y).toBeGreaterThanOrEqual(firstNode.position.y + firstNode.height + gap);
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

  it("reorders step sequence from canvas actions and keeps canonical order contiguous", () => {
    let draft = createEmptyWorkflowDraft();
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;

    const stepIds = draft.steps.map((step) => step.id);
    const reordered = [stepIds[2] as string, stepIds[0] as string, stepIds[1] as string];
    draft = applyWorkflowCanvasAction(draft, {
      kind: "reorder-steps",
      orderedStepIds: reordered,
    }).draft;

    expect(draft.steps.map((step) => step.id)).toEqual(reordered);
    expect(draft.steps.map((step) => step.order)).toEqual([1, 2, 3]);
  });

  it("creates, reconnects, and removes supported canvas edges via canonical draft mutations", () => {
    let draft = createEmptyWorkflowDraft();
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-output" }).draft;

    const before = deriveWorkflowCanvasViewModel(draft, []);
    const firstStepNode = before.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
      && node.entityId === draft.steps[0]?.id
    ));
    const secondStepNode = before.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
      && node.entityId === draft.steps[1]?.id
    ));
    const outputNode = before.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.outputs
      && node.entityId === draft.outputs[0]?.id
    ));
    if (!firstStepNode || !secondStepNode || !outputNode) {
      throw new Error("Expected step and output graph nodes to exist.");
    }

    draft = applyWorkflowCanvasConnection(draft, before.graph, {
      sourceNodeId: firstStepNode.id,
      targetNodeId: secondStepNode.id,
    }).draft;
    expect(draft.steps[1]?.dependsOnStepIds).toContain(draft.steps[0]?.id);

    draft = applyWorkflowCanvasConnection(draft, before.graph, {
      sourceNodeId: secondStepNode.id,
      targetNodeId: outputNode.id,
    }).draft;
    expect(draft.outputs[0]?.sourceStepId).toBe(draft.steps[1]?.id);

    let withEdges = deriveWorkflowCanvasViewModel(draft, []);
    const dependencyEdge = withEdges.graph.edges.find((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.stepDependency);
    const outputSourceEdge = withEdges.graph.edges.find((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.outputSource);
    if (!dependencyEdge || !outputSourceEdge) {
      throw new Error("Expected editable dependency and output-source edges.");
    }

    draft = applyWorkflowCanvasEdgeReconnect(draft, withEdges.graph, {
      edge: outputSourceEdge,
      nextConnection: {
        sourceNodeId: firstStepNode.id,
        targetNodeId: outputNode.id,
      },
    }).draft;
    expect(draft.outputs[0]?.sourceStepId).toBe(draft.steps[0]?.id);

    withEdges = deriveWorkflowCanvasViewModel(draft, []);
    const removableDependencyEdge = withEdges.graph.edges.find((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.stepDependency);
    if (!removableDependencyEdge) {
      throw new Error("Expected dependency edge for removal.");
    }
    const removeAction = resolveWorkflowCanvasEdgeRemovalAction(removableDependencyEdge);
    if (!removeAction) {
      throw new Error("Expected remove action for dependency edge.");
    }
    draft = applyWorkflowCanvasAction(draft, removeAction).draft;
    expect(draft.steps[1]?.dependsOnStepIds ?? []).not.toContain(draft.steps[0]?.id);
  });

  it("projects if-then branching config as editable branch edges and reconciles branch edits into canonical draft", () => {
    let draft = createEmptyWorkflowDraft();
    draft = applyWorkflowCanvasAction(draft, {
      kind: "add-step",
      definitionKey: "built-in:control-flow:if-then",
    }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;

    const ifThenStepId = draft.steps[0]?.id as string;
    const thenStepId = draft.steps[1]?.id as string;
    const elseStepId = draft.steps[2]?.id as string;

    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-step-if-then-branch-target",
      stepId: ifThenStepId,
      branchKey: "then",
      targetStepId: thenStepId,
    }).draft;
    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-step-if-then-branch-target",
      stepId: ifThenStepId,
      branchKey: "else",
      targetStepId: elseStepId,
    }).draft;

    const withBranches = deriveWorkflowCanvasViewModel(draft, []);
    const branchEdges = withBranches.graph.edges.filter((edge) => edge.kind === WorkflowCanvasGraphEdgeKinds.stepBranch);
    expect(branchEdges).toHaveLength(2);
    expect(branchEdges.some((edge) => edge.branchKey === "then")).toBe(true);
    expect(branchEdges.some((edge) => edge.branchKey === "else")).toBe(true);

    const ifThenNode = withBranches.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
      && node.entityId === ifThenStepId
    ));
    const replacementElseNode = withBranches.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
      && node.entityId === thenStepId
    ));
    const elseBranchEdge = branchEdges.find((edge) => edge.branchKey === "else");
    if (!ifThenNode || !replacementElseNode || !elseBranchEdge) {
      throw new Error("Expected if-then node and branch edges.");
    }

    draft = applyWorkflowCanvasEdgeReconnect(draft, withBranches.graph, {
      edge: elseBranchEdge,
      nextConnection: {
        sourceNodeId: ifThenNode.id,
        targetNodeId: replacementElseNode.id,
        sourceHandleId: elseBranchEdge.sourceHandleId,
      },
    }).draft;

    const reprojected = deriveWorkflowCanvasViewModel(draft, []);
    const reprojectedElseEdge = reprojected.graph.edges.find((edge) => (
      edge.kind === WorkflowCanvasGraphEdgeKinds.stepBranch
      && edge.branchKey === "else"
    ));
    expect(reprojectedElseEdge?.targetEntityId).toBe(thenStepId);

    const removedAction = resolveWorkflowCanvasEdgeRemovalAction(reprojectedElseEdge!);
    if (!removedAction) {
      throw new Error("Expected else branch removal action.");
    }
    draft = applyWorkflowCanvasAction(draft, removedAction).draft;
    const finalConfig = draft.steps.find((step) => step.id === ifThenStepId)?.config as {
      elseStepIds?: ReadonlyArray<string>;
      branches?: { else?: { stepIds?: ReadonlyArray<string> } };
    };
    expect(finalConfig.branches?.else?.stepIds ?? finalConfig.elseStepIds ?? []).toHaveLength(0);
  });

  it("supports explicit canvas actions for dataset-input and agent-step asset references", () => {
    let draft = createEmptyWorkflowDraft();
    draft = applyWorkflowCanvasAction(draft, { kind: "add-input-dataset-asset" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;
    const datasetInputId = draft.inputs[0]?.id as string;
    const stepId = draft.steps[0]?.id as string;

    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-input-dataset-asset",
      inputId: datasetInputId,
      assetId: "asset:dataset-selected",
      versionId: "asset:dataset-selected:v1",
      displayName: "Selected Dataset",
    }).draft;

    draft = applyWorkflowCanvasAction(draft, {
      kind: "set-step-agent-asset",
      stepId,
      assetId: "asset:agent-selected",
      versionId: "asset:agent-selected:v2",
      displayName: "Selected Agent",
    }).draft;

    expect(draft.inputs[0]?.sourceType).toBe("dataset-asset");
    expect((draft.inputs[0] as { asset?: { assetId?: string; versionId?: string } }).asset?.assetId).toBe("asset:dataset-selected");
    expect(draft.steps[0]?.type).toBe(WorkflowDraftStepTypes.agentAssistant);
    expect(draft.steps[0]?.assetRef?.asset.assetId).toBe("asset:agent-selected");
  });

  it("rejects invalid canvas connection attempts and leaves canonical draft unchanged", () => {
    let draft = createEmptyWorkflowDraft();
    draft = applyWorkflowCanvasAction(draft, { kind: "add-trigger" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-input-runtime-parameter" }).draft;
    draft = applyWorkflowCanvasAction(draft, { kind: "add-step" }).draft;

    const viewModel = deriveWorkflowCanvasViewModel(draft, []);
    const triggerNode = viewModel.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.triggers
    ));
    const stepNode = viewModel.graph.nodes.find((node) => (
      node.kind === WorkflowCanvasGraphNodeKinds.item
      && node.sectionId === WorkflowCanvasSectionIds.steps
    ));
    if (!triggerNode || !stepNode) {
      throw new Error("Expected trigger and step graph nodes.");
    }

    const request = {
      sourceNodeId: triggerNode.id,
      targetNodeId: stepNode.id,
    };
    const resolution = resolveWorkflowCanvasConnectionAction(viewModel.graph, request);
    expect(resolution.valid).toBe(false);
    expect(resolution.reason).toContain("Unsupported connection");

    const result = applyWorkflowCanvasConnection(draft, viewModel.graph, request);
    expect(result.changed).toBe(false);
    expect(result.draft).toBe(draft);
  });

  it("projects validation issue counts into the canvas summary and node issues", () => {
    const draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      steps: Object.freeze([
        Object.freeze({
          id: "step-2",
          type: "action",
          kind: WorkflowDraftStepKinds.action,
          order: 2,
          title: "Out of order step",
        }),
      ]),
    });

    const viewModel = deriveWorkflowCanvasViewModel(draft, [{
      code: "step-order-non-contiguous",
      section: "steps",
      severity: "error",
      message: "Step order must be contiguous.",
      path: "draft.steps[0].order",
    }]);

    expect(viewModel.totalIssueCount).toBe(1);
    const stepNode = viewModel.sections
      .find((section) => section.id === WorkflowCanvasSectionIds.steps)
      ?.nodes[0];
    expect(stepNode?.issueMessages).toEqual(["Step order must be contiguous."]);
  });
});
