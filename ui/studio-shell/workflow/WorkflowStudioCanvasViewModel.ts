import {
  WorkflowDraftInputSourceTypes,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftStepKinds,
  WorkflowDraftTriggerTypes,
  WorkflowDraftInputValueTypes,
  type WorkflowDraft,
  type WorkflowDraftInput,
  type WorkflowDraftOutputDestinationType,
  type WorkflowDraftTriggerType,
  type WorkflowValidationIssue,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  addWorkflowTrigger,
  getWorkflowTriggerSummary,
  getWorkflowTriggerTypeDefinition,
  removeWorkflowTrigger,
  setWorkflowTriggerTitle,
} from "./WorkflowWizardTriggers";
import {
  addWorkflowStepDependency,
  addWorkflowStep,
  getWorkflowStepTypeDefinitionByKey,
  removeWorkflowStepDependency,
  reorderWorkflowSteps,
  removeWorkflowStep,
  resolveWorkflowStepTypeDefinition,
  setWorkflowStepTitle,
} from "./WorkflowWizardSteps";
import {
  addWorkflowOutput,
  getWorkflowOutputDestinationDefinitionByType,
  listWorkflowOutputSummaries,
  removeWorkflowOutput,
  setWorkflowOutputSourceStep,
  setWorkflowOutputViewerTitle,
} from "./WorkflowWizardOutputs";
import { buildDatasetInputFromAsset } from "./WorkflowWizardDatasetInputs";

export const WorkflowCanvasSectionIds = Object.freeze({
  triggers: "triggers",
  inputs: "inputs",
  steps: "steps",
  outputs: "outputs",
});

export type WorkflowCanvasSectionId =
  typeof WorkflowCanvasSectionIds[keyof typeof WorkflowCanvasSectionIds];

export interface WorkflowCanvasNodeViewModel {
  readonly id: string;
  readonly sectionId: WorkflowCanvasSectionId;
  readonly title: string;
  readonly subtitle: string;
  readonly detailLines: ReadonlyArray<string>;
  readonly issueMessages: ReadonlyArray<string>;
}

export interface WorkflowCanvasSectionViewModel {
  readonly id: WorkflowCanvasSectionId;
  readonly title: string;
  readonly summary: string;
  readonly nodes: ReadonlyArray<WorkflowCanvasNodeViewModel>;
}

export interface WorkflowCanvasViewModel {
  readonly sections: ReadonlyArray<WorkflowCanvasSectionViewModel>;
  readonly graph: WorkflowCanvasGraphViewModel;
  readonly totalNodeCount: number;
  readonly totalIssueCount: number;
}

export const WorkflowCanvasGraphNodeKinds = Object.freeze({
  section: "section",
  item: "item",
});

export type WorkflowCanvasGraphNodeKind =
  typeof WorkflowCanvasGraphNodeKinds[keyof typeof WorkflowCanvasGraphNodeKinds];

export const WorkflowCanvasGraphEdgeKinds = Object.freeze({
  sectionFlow: "section-flow",
  sectionEntry: "section-entry",
  itemSequence: "item-sequence",
  stepDependency: "step-dependency",
  outputSource: "output-source",
});

export type WorkflowCanvasGraphEdgeKind =
  typeof WorkflowCanvasGraphEdgeKinds[keyof typeof WorkflowCanvasGraphEdgeKinds];

export interface WorkflowCanvasGraphPosition {
  readonly x: number;
  readonly y: number;
}

export interface WorkflowCanvasGraphNodeViewModel {
  readonly id: string;
  readonly kind: WorkflowCanvasGraphNodeKind;
  readonly sectionId: WorkflowCanvasSectionId;
  readonly entityId?: string;
  readonly title: string;
  readonly subtitle: string;
  readonly detailLines: ReadonlyArray<string>;
  readonly issueCount: number;
  readonly height: number;
  readonly position: WorkflowCanvasGraphPosition;
}

export interface WorkflowCanvasGraphEdgeViewModel {
  readonly id: string;
  readonly kind: WorkflowCanvasGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceEntityId?: string;
  readonly targetEntityId?: string;
  readonly editable: boolean;
}

export interface WorkflowCanvasGraphLayoutViewModel {
  readonly sectionColumnWidth: number;
  readonly sectionNodeHeight: number;
  readonly itemNodeHeight: number;
  readonly nodeVerticalGap: number;
  readonly maxCharactersPerLine: number;
}

export interface WorkflowCanvasGraphViewModel {
  readonly nodes: ReadonlyArray<WorkflowCanvasGraphNodeViewModel>;
  readonly edges: ReadonlyArray<WorkflowCanvasGraphEdgeViewModel>;
  readonly layout: WorkflowCanvasGraphLayoutViewModel;
}

const WorkflowCanvasGraphLayout = Object.freeze({
  sectionColumnWidth: 360,
  sectionNodeHeight: 120,
  itemNodeHeight: 148,
  nodeVerticalGap: 24,
  maxCharactersPerLine: 36,
});

function buildSectionGraphNodeId(sectionId: WorkflowCanvasSectionId): string {
  return `section:${sectionId}`;
}

function buildItemGraphNodeId(node: WorkflowCanvasNodeViewModel): string {
  return `item:${node.sectionId}:${node.id}`;
}

function buildGraphEdgeId(sourceNodeId: string, targetNodeId: string): string {
  return `edge:${sourceNodeId}->${targetNodeId}`;
}

function buildStepDependencyEdgeId(dependsOnStepId: string, stepId: string): string {
  return `edge:step-dependency:${dependsOnStepId}->${stepId}`;
}

function buildOutputSourceEdgeId(sourceStepId: string, outputId: string): string {
  return `edge:output-source:${sourceStepId}->${outputId}`;
}

function estimateTextLineCount(
  value: string,
  maxCharactersPerLine: number,
): number {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / maxCharactersPerLine));
}

function estimateNodeLineCount(
  node: Pick<WorkflowCanvasGraphNodeViewModel, "subtitle" | "detailLines" | "issueCount">,
  layout: WorkflowCanvasGraphLayoutViewModel,
): number {
  const subtitleLines = estimateTextLineCount(node.subtitle, layout.maxCharactersPerLine);
  const detailLines = node.detailLines.reduce(
    (sum, line) => sum + estimateTextLineCount(line, layout.maxCharactersPerLine),
    0,
  );
  const issueLines = node.issueCount > 0 ? 1 : 0;
  return subtitleLines + detailLines + issueLines;
}

function getSectionGraphNodeHeight(
  subtitle: string,
  issueCount: number,
  nodeCount: number,
  layout: WorkflowCanvasGraphLayoutViewModel,
): number {
  const estimatedLines = estimateNodeLineCount(
    {
      subtitle,
      detailLines: Object.freeze([`${nodeCount} node(s)`]),
      issueCount,
    },
    layout,
  );
  const baseHeight = 56;
  const lineHeight = 18;
  return Math.max(
    layout.sectionNodeHeight,
    baseHeight + (estimatedLines * lineHeight),
  );
}

function getItemGraphNodeHeight(
  node: Pick<WorkflowCanvasGraphNodeViewModel, "sectionId" | "subtitle" | "detailLines" | "issueCount">,
  layout: WorkflowCanvasGraphLayoutViewModel,
): number {
  const estimatedLines = estimateNodeLineCount(node, layout);
  const sectionEditorHeight = node.sectionId === WorkflowCanvasSectionIds.triggers
    || node.sectionId === WorkflowCanvasSectionIds.steps
    ? 104
    : 72;
  const baseHeight = 66;
  const lineHeight = 18;
  return Math.max(
    layout.itemNodeHeight,
    baseHeight + sectionEditorHeight + (estimatedLines * lineHeight),
  );
}

function getGraphNodeHeight(
  node: WorkflowCanvasGraphNodeViewModel,
): number {
  return node.height;
}

function placeSectionGraphNodes(
  sectionNodes: ReadonlyArray<WorkflowCanvasGraphNodeViewModel>,
  layout: WorkflowCanvasGraphLayoutViewModel,
): ReadonlyArray<WorkflowCanvasGraphNodeViewModel> {
  let cursorY = 0;
  const placedNodes: WorkflowCanvasGraphNodeViewModel[] = [];
  for (const node of sectionNodes) {
    placedNodes.push(Object.freeze({
      ...node,
      position: Object.freeze({
        x: node.position.x,
        y: cursorY,
      }),
    }));
    cursorY += getGraphNodeHeight(node) + layout.nodeVerticalGap;
  }

  return Object.freeze(placedNodes);
}

function deriveWorkflowCanvasGraphViewModel(
  draft: WorkflowDraft,
  sections: ReadonlyArray<WorkflowCanvasSectionViewModel>,
): WorkflowCanvasGraphViewModel {
  const graphNodes: WorkflowCanvasGraphNodeViewModel[] = [];
  const graphEdges: WorkflowCanvasGraphEdgeViewModel[] = [];
  const sectionEntryNodeIds = new Map<WorkflowCanvasSectionId, string>();
  const sectionExitNodeIds = new Map<WorkflowCanvasSectionId, string>();

  sections.forEach((section, sectionIndex) => {
    const sectionNodeId = buildSectionGraphNodeId(section.id);
    const sectionIssueCount = section.nodes.reduce((sum, node) => sum + node.issueMessages.length, 0);
    const sectionNode = Object.freeze({
      id: sectionNodeId,
      kind: WorkflowCanvasGraphNodeKinds.section,
      sectionId: section.id,
      entityId: undefined,
      title: section.title,
      subtitle: section.summary,
      detailLines: Object.freeze([`${section.nodes.length} node(s)`]),
      issueCount: sectionIssueCount,
      height: getSectionGraphNodeHeight(
        section.summary,
        sectionIssueCount,
        section.nodes.length,
        WorkflowCanvasGraphLayout,
      ),
      position: Object.freeze({
        x: sectionIndex * WorkflowCanvasGraphLayout.sectionColumnWidth,
        y: 0,
      }),
    } satisfies WorkflowCanvasGraphNodeViewModel);
    const sectionGraphNodes: WorkflowCanvasGraphNodeViewModel[] = [sectionNode];

    if (section.nodes.length === 0) {
      graphNodes.push(sectionNode);
      sectionEntryNodeIds.set(section.id, sectionNodeId);
      sectionExitNodeIds.set(section.id, sectionNodeId);
      return;
    }

    let previousItemNodeId: string | undefined;
    section.nodes.forEach((node, nodeIndex) => {
      const itemNodeId = buildItemGraphNodeId(node);
      const issueCount = node.issueMessages.length;
      const itemGraphNode = Object.freeze({
        id: itemNodeId,
        kind: WorkflowCanvasGraphNodeKinds.item,
        sectionId: section.id,
        entityId: node.id,
        title: node.title,
        subtitle: node.subtitle,
        detailLines: node.detailLines,
        issueCount,
        height: getItemGraphNodeHeight({
          sectionId: section.id,
          subtitle: node.subtitle,
          detailLines: node.detailLines,
          issueCount,
        }, WorkflowCanvasGraphLayout),
        position: Object.freeze({
          x: sectionIndex * WorkflowCanvasGraphLayout.sectionColumnWidth,
          y: 0,
        }),
      } satisfies WorkflowCanvasGraphNodeViewModel);
      sectionGraphNodes.push(itemGraphNode);

      if (nodeIndex === 0) {
        graphEdges.push(Object.freeze({
          id: buildGraphEdgeId(sectionNodeId, itemNodeId),
          kind: WorkflowCanvasGraphEdgeKinds.sectionEntry,
          sourceNodeId: sectionNodeId,
          targetNodeId: itemNodeId,
          sourceEntityId: undefined,
          targetEntityId: node.id,
          editable: false,
        }));
        sectionEntryNodeIds.set(section.id, itemNodeId);
      }

      if (previousItemNodeId) {
        graphEdges.push(Object.freeze({
          id: buildGraphEdgeId(previousItemNodeId, itemNodeId),
          kind: WorkflowCanvasGraphEdgeKinds.itemSequence,
          sourceNodeId: previousItemNodeId,
          targetNodeId: itemNodeId,
          sourceEntityId: section.nodes[nodeIndex - 1]?.id,
          targetEntityId: node.id,
          editable: false,
        }));
      }

      previousItemNodeId = itemNodeId;
      sectionExitNodeIds.set(section.id, itemNodeId);
    });

    const placedNodes = placeSectionGraphNodes(sectionGraphNodes, WorkflowCanvasGraphLayout);
    graphNodes.push(...placedNodes);
  });

  for (let index = 0; index < sections.length - 1; index += 1) {
    const currentSection = sections[index] as WorkflowCanvasSectionViewModel;
    const nextSection = sections[index + 1] as WorkflowCanvasSectionViewModel;
    const sourceNodeId = sectionExitNodeIds.get(currentSection.id);
    const targetNodeId = sectionEntryNodeIds.get(nextSection.id);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    graphEdges.push(Object.freeze({
      id: buildGraphEdgeId(sourceNodeId, targetNodeId),
      kind: WorkflowCanvasGraphEdgeKinds.sectionFlow,
      sourceNodeId,
      targetNodeId,
      sourceEntityId: undefined,
      targetEntityId: undefined,
      editable: false,
    }));
  }

  const stepNodeIdByStepId = new Map(
    graphNodes
      .filter((node) => node.sectionId === WorkflowCanvasSectionIds.steps && node.kind === WorkflowCanvasGraphNodeKinds.item)
      .map((node) => [node.entityId as string, node.id]),
  );
  const outputNodeIdByOutputId = new Map(
    graphNodes
      .filter((node) => node.sectionId === WorkflowCanvasSectionIds.outputs && node.kind === WorkflowCanvasGraphNodeKinds.item)
      .map((node) => [node.entityId as string, node.id]),
  );

  for (const step of draft.steps) {
    const targetNodeId = stepNodeIdByStepId.get(step.id);
    if (!targetNodeId) {
      continue;
    }

    for (const dependsOnStepId of step.dependsOnStepIds ?? []) {
      const sourceNodeId = stepNodeIdByStepId.get(dependsOnStepId);
      if (!sourceNodeId) {
        continue;
      }
      graphEdges.push(Object.freeze({
        id: buildStepDependencyEdgeId(dependsOnStepId, step.id),
        kind: WorkflowCanvasGraphEdgeKinds.stepDependency,
        sourceNodeId,
        targetNodeId,
        sourceEntityId: dependsOnStepId,
        targetEntityId: step.id,
        editable: true,
      }));
    }
  }

  for (const output of draft.outputs) {
    const sourceStepId = output.sourceStepId?.trim();
    if (!sourceStepId) {
      continue;
    }
    const sourceNodeId = stepNodeIdByStepId.get(sourceStepId);
    const targetNodeId = outputNodeIdByOutputId.get(output.id);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }
    graphEdges.push(Object.freeze({
      id: buildOutputSourceEdgeId(sourceStepId, output.id),
      kind: WorkflowCanvasGraphEdgeKinds.outputSource,
      sourceNodeId,
      targetNodeId,
      sourceEntityId: sourceStepId,
      targetEntityId: output.id,
      editable: true,
    }));
  }

  return Object.freeze({
    nodes: Object.freeze(graphNodes),
    edges: Object.freeze(graphEdges),
    layout: WorkflowCanvasGraphLayout,
  });
}

export type WorkflowCanvasAction =
  | { readonly kind: "add-trigger"; readonly triggerType?: WorkflowDraftTriggerType }
  | { readonly kind: "set-trigger-title"; readonly triggerId: string; readonly title: string }
  | { readonly kind: "remove-trigger"; readonly triggerId: string }
  | { readonly kind: "add-input-runtime-parameter" }
  | { readonly kind: "add-input-dataset-asset" }
  | { readonly kind: "add-input-static-value" }
  | { readonly kind: "set-input-title"; readonly inputId: string; readonly title: string }
  | { readonly kind: "remove-input"; readonly inputId: string }
  | { readonly kind: "add-step"; readonly definitionKey?: string }
  | { readonly kind: "reorder-steps"; readonly orderedStepIds: ReadonlyArray<string> }
  | { readonly kind: "set-step-title"; readonly stepId: string; readonly title: string }
  | { readonly kind: "add-step-dependency"; readonly stepId: string; readonly dependsOnStepId: string }
  | { readonly kind: "remove-step-dependency"; readonly stepId: string; readonly dependsOnStepId: string }
  | { readonly kind: "remove-step"; readonly stepId: string }
  | { readonly kind: "add-output"; readonly destinationType?: WorkflowDraftOutputDestinationType }
  | { readonly kind: "set-output-title"; readonly outputId: string; readonly title: string }
  | { readonly kind: "set-output-source-step"; readonly outputId: string; readonly sourceStepId?: string }
  | { readonly kind: "remove-output"; readonly outputId: string };

export interface WorkflowCanvasActionResult {
  readonly draft: WorkflowDraft;
  readonly changed: boolean;
}

export interface WorkflowCanvasConnectionRequest {
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
}

export interface WorkflowCanvasConnectionResolution {
  readonly valid: boolean;
  readonly action?: WorkflowCanvasAction;
}

export interface WorkflowCanvasEdgeUpdateRequest {
  readonly edge: WorkflowCanvasGraphEdgeViewModel;
  readonly nextConnection: WorkflowCanvasConnectionRequest;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function getIssueMessagesForPathPrefix(
  issues: ReadonlyArray<WorkflowValidationIssue>,
  pathPrefix: string,
): ReadonlyArray<string> {
  return Object.freeze(
    issues
      .filter((issue) => issue.path?.startsWith(pathPrefix))
      .map((issue) => issue.message),
  );
}

function buildNextRuntimeInputId(draft: WorkflowDraft): string {
  const existing = new Set(draft.inputs.map((input) => input.id));
  let index = draft.inputs.length + 1;
  let candidate = `input-runtime-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `input-runtime-${index}`;
  }
  return candidate;
}

function buildNextStaticInputId(draft: WorkflowDraft): string {
  const existing = new Set(draft.inputs.map((input) => input.id));
  let index = draft.inputs.length + 1;
  let candidate = `input-static-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `input-static-${index}`;
  }
  return candidate;
}

function buildNextDatasetAssetId(draft: WorkflowDraft): string {
  let index = draft.inputs.length + 1;
  let candidate = `asset:dataset-${index}`;
  const existingIds = new Set(
    draft.inputs
      .filter((input) => input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset)
      .map((input) => input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset ? input.asset.assetId : ""),
  );
  while (existingIds.has(candidate)) {
    index += 1;
    candidate = `asset:dataset-${index}`;
  }
  return candidate;
}

function describeInput(input: WorkflowDraftInput): { readonly subtitle: string; readonly details: ReadonlyArray<string> } {
  if (input.sourceType === WorkflowDraftInputSourceTypes.datasetAsset) {
    return Object.freeze({
      subtitle: "Dataset input",
      details: Object.freeze([
        `Asset: ${input.asset.assetId}`,
        ...(input.asset.versionId ? [`Version: ${input.asset.versionId}`] : []),
      ]),
    });
  }

  if (input.sourceType === WorkflowDraftInputSourceTypes.runtimeParameter) {
    return Object.freeze({
      subtitle: "Runtime parameter",
      details: Object.freeze([
        `Key: ${input.parameterKey ?? "not set"}`,
        `Value type: ${input.valueType ?? "unknown"}`,
      ]),
    });
  }

  return Object.freeze({
    subtitle: "Static value",
    details: Object.freeze([
      `Value type: ${input.valueType ?? "unknown"}`,
      `Value: ${typeof input.value === "string" ? input.value : JSON.stringify(input.value ?? null)}`,
    ]),
  });
}

function deriveTriggerNodes(
  draft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<WorkflowCanvasNodeViewModel> {
  return Object.freeze(
    draft.triggers.map((trigger, index) => {
      const definition = getWorkflowTriggerTypeDefinition(trigger.type);
      const issueMessages = getIssueMessagesForPathPrefix(draftValidationIssues, `draft.triggers[${index}]`);
      return Object.freeze({
        id: trigger.id,
        sectionId: WorkflowCanvasSectionIds.triggers,
        title: trigger.title?.trim() || `${definition?.label ?? trigger.type} ${index + 1}`,
        subtitle: definition ? `${definition.label} (${definition.kind})` : trigger.type,
        detailLines: Object.freeze([getWorkflowTriggerSummary(trigger)]),
        issueMessages,
      });
    }),
  );
}

function deriveInputNodes(
  draft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<WorkflowCanvasNodeViewModel> {
  return Object.freeze(
    draft.inputs.map((input, index) => {
      const descriptor = describeInput(input);
      const issueMessages = getIssueMessagesForPathPrefix(draftValidationIssues, `draft.inputs[${index}]`);
      return Object.freeze({
        id: input.id,
        sectionId: WorkflowCanvasSectionIds.inputs,
        title: input.title?.trim() || `Input ${index + 1}`,
        subtitle: descriptor.subtitle,
        detailLines: descriptor.details,
        issueMessages,
      });
    }),
  );
}

function deriveStepNodes(
  draft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<WorkflowCanvasNodeViewModel> {
  return Object.freeze(
    draft.steps.map((step, index) => {
      const definition = resolveWorkflowStepTypeDefinition(step);
      const issueMessages = getIssueMessagesForPathPrefix(draftValidationIssues, `draft.steps[${index}]`);
      const detailLines: string[] = [`Order: ${step.order}`];
      if (step.assetRef?.asset.assetId) {
        detailLines.push(`Asset: ${step.assetRef.asset.assetId}`);
      }
      if (step.kind === WorkflowDraftStepKinds.controlFlow) {
        detailLines.push("Built-in control-flow step");
      }
      return Object.freeze({
        id: step.id,
        sectionId: WorkflowCanvasSectionIds.steps,
        title: step.title?.trim() || `${definition.label} ${index + 1}`,
        subtitle: definition.summary,
        detailLines: Object.freeze(detailLines),
        issueMessages,
      });
    }),
  );
}

function deriveOutputNodes(
  draft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyArray<WorkflowCanvasNodeViewModel> {
  const outputSummaries = listWorkflowOutputSummaries(draft);
  return Object.freeze(
    draft.outputs.map((output, index) => {
      const definition = getWorkflowOutputDestinationDefinitionByType(output.destination.type);
      const summary = outputSummaries.find((item) => item.outputId === output.id);
      const issueMessages = getIssueMessagesForPathPrefix(draftValidationIssues, `draft.outputs[${index}]`);
      return Object.freeze({
        id: output.id,
        sectionId: WorkflowCanvasSectionIds.outputs,
        title: output.title?.trim() || summary?.displayLabel || `Output ${output.order ?? (index + 1)}`,
        subtitle: definition.label,
        detailLines: Object.freeze([
          `Format: ${output.format}`,
          ...(summary?.detailLines ?? []),
        ]),
        issueMessages,
      });
    }),
  );
}

function updateInput(
  draft: WorkflowDraft,
  inputId: string,
  updater: (input: WorkflowDraftInput) => WorkflowDraftInput,
): WorkflowCanvasActionResult {
  const index = draft.inputs.findIndex((input) => input.id === inputId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const current = draft.inputs[index] as WorkflowDraftInput;
  const next = updater(current);
  if (next === current) {
    return Object.freeze({ draft, changed: false });
  }

  const inputs = [...draft.inputs];
  inputs[index] = next;
  return Object.freeze({
    changed: true,
    draft: Object.freeze({
      ...draft,
      inputs: Object.freeze(inputs),
    }),
  });
}

export function deriveWorkflowCanvasViewModel(
  draft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): WorkflowCanvasViewModel {
  const triggerNodes = deriveTriggerNodes(draft, draftValidationIssues);
  const inputNodes = deriveInputNodes(draft, draftValidationIssues);
  const stepNodes = deriveStepNodes(draft, draftValidationIssues);
  const outputNodes = deriveOutputNodes(draft, draftValidationIssues);
  const sections = Object.freeze([
    Object.freeze({
      id: WorkflowCanvasSectionIds.triggers,
      title: "Triggers",
      summary: "How workflow execution starts.",
      nodes: triggerNodes,
    }),
    Object.freeze({
      id: WorkflowCanvasSectionIds.inputs,
      title: "Inputs",
      summary: "Data or runtime parameters consumed by the workflow.",
      nodes: inputNodes,
    }),
    Object.freeze({
      id: WorkflowCanvasSectionIds.steps,
      title: "Steps",
      summary: "Ordered workflow actions and control-flow units.",
      nodes: stepNodes,
    }),
    Object.freeze({
      id: WorkflowCanvasSectionIds.outputs,
      title: "Outputs",
      summary: "Delivery destinations for workflow results.",
      nodes: outputNodes,
    }),
  ]);
  const graph = deriveWorkflowCanvasGraphViewModel(draft, sections);

  return Object.freeze({
    sections,
    graph,
    totalNodeCount: sections.reduce((sum, section) => sum + section.nodes.length, 0),
    totalIssueCount: sections.reduce((sum, section) => (
      sum + section.nodes.reduce((sectionSum, node) => sectionSum + node.issueMessages.length, 0)
    ), 0),
  });
}

function getGraphNodeById(
  graph: WorkflowCanvasGraphViewModel,
  nodeId: string,
): WorkflowCanvasGraphNodeViewModel | undefined {
  return graph.nodes.find((node) => node.id === nodeId);
}

export function resolveWorkflowCanvasConnectionAction(
  graph: WorkflowCanvasGraphViewModel,
  request: WorkflowCanvasConnectionRequest,
): WorkflowCanvasConnectionResolution {
  const sourceNode = getGraphNodeById(graph, request.sourceNodeId);
  const targetNode = getGraphNodeById(graph, request.targetNodeId);
  if (!sourceNode || !targetNode) {
    return Object.freeze({ valid: false });
  }

  if (sourceNode.kind !== WorkflowCanvasGraphNodeKinds.item || targetNode.kind !== WorkflowCanvasGraphNodeKinds.item) {
    return Object.freeze({ valid: false });
  }
  if (!sourceNode.entityId || !targetNode.entityId) {
    return Object.freeze({ valid: false });
  }

  if (
    sourceNode.sectionId === WorkflowCanvasSectionIds.steps
    && targetNode.sectionId === WorkflowCanvasSectionIds.steps
    && sourceNode.entityId !== targetNode.entityId
  ) {
    return Object.freeze({
      valid: true,
      action: Object.freeze({
        kind: "add-step-dependency",
        stepId: targetNode.entityId,
        dependsOnStepId: sourceNode.entityId,
      }),
    });
  }

  if (
    sourceNode.sectionId === WorkflowCanvasSectionIds.steps
    && targetNode.sectionId === WorkflowCanvasSectionIds.outputs
  ) {
    return Object.freeze({
      valid: true,
      action: Object.freeze({
        kind: "set-output-source-step",
        outputId: targetNode.entityId,
        sourceStepId: sourceNode.entityId,
      }),
    });
  }

  return Object.freeze({ valid: false });
}

export function resolveWorkflowCanvasEdgeRemovalAction(
  edge: WorkflowCanvasGraphEdgeViewModel,
): WorkflowCanvasAction | undefined {
  if (
    edge.kind === WorkflowCanvasGraphEdgeKinds.stepDependency
    && edge.sourceEntityId
    && edge.targetEntityId
  ) {
    return Object.freeze({
      kind: "remove-step-dependency",
      stepId: edge.targetEntityId,
      dependsOnStepId: edge.sourceEntityId,
    });
  }
  if (edge.kind === WorkflowCanvasGraphEdgeKinds.outputSource && edge.targetEntityId) {
    return Object.freeze({
      kind: "set-output-source-step",
      outputId: edge.targetEntityId,
      sourceStepId: undefined,
    });
  }
  return undefined;
}

export function applyWorkflowCanvasConnection(
  draft: WorkflowDraft,
  graph: WorkflowCanvasGraphViewModel,
  request: WorkflowCanvasConnectionRequest,
): WorkflowCanvasActionResult {
  const resolution = resolveWorkflowCanvasConnectionAction(graph, request);
  if (!resolution.valid || !resolution.action) {
    return Object.freeze({ draft, changed: false });
  }
  return applyWorkflowCanvasAction(draft, resolution.action);
}

export function applyWorkflowCanvasEdgeReconnect(
  draft: WorkflowDraft,
  graph: WorkflowCanvasGraphViewModel,
  request: WorkflowCanvasEdgeUpdateRequest,
): WorkflowCanvasActionResult {
  const removeAction = resolveWorkflowCanvasEdgeRemovalAction(request.edge);
  if (!removeAction) {
    return Object.freeze({ draft, changed: false });
  }
  const addResolution = resolveWorkflowCanvasConnectionAction(graph, request.nextConnection);
  if (!addResolution.valid || !addResolution.action) {
    return Object.freeze({ draft, changed: false });
  }
  if (
    request.edge.kind === WorkflowCanvasGraphEdgeKinds.stepDependency
    && addResolution.action.kind !== "add-step-dependency"
  ) {
    return Object.freeze({ draft, changed: false });
  }
  if (
    request.edge.kind === WorkflowCanvasGraphEdgeKinds.outputSource
    && addResolution.action.kind !== "set-output-source-step"
  ) {
    return Object.freeze({ draft, changed: false });
  }

  const removed = applyWorkflowCanvasAction(draft, removeAction);
  const added = applyWorkflowCanvasAction(removed.draft, addResolution.action);
  if (!added.changed) {
    return Object.freeze({ draft, changed: false });
  }
  return Object.freeze({
    draft: added.draft,
    changed: true,
  });
}

export function applyWorkflowCanvasAction(
  draft: WorkflowDraft,
  action: WorkflowCanvasAction,
): WorkflowCanvasActionResult {
  if (action.kind === "add-trigger") {
    const result = addWorkflowTrigger(draft, { type: action.triggerType ?? WorkflowDraftTriggerTypes.userManual });
    return Object.freeze({ draft: result.draft, changed: true });
  }

  if (action.kind === "set-trigger-title") {
    const result = setWorkflowTriggerTitle(draft, action.triggerId, action.title);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "remove-trigger") {
    const result = removeWorkflowTrigger(draft, action.triggerId);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "add-input-runtime-parameter") {
    const nextId = buildNextRuntimeInputId(draft);
    const inputs = Object.freeze([
      ...draft.inputs,
      Object.freeze({
        id: nextId,
        type: "runtime-parameter-input",
        title: `Runtime input ${draft.inputs.length + 1}`,
        sourceType: WorkflowDraftInputSourceTypes.runtimeParameter,
        parameterKey: `input_${draft.inputs.length + 1}`,
        valueType: WorkflowDraftInputValueTypes.string,
        required: true,
      }),
    ]);
    return Object.freeze({
      changed: true,
      draft: Object.freeze({
        ...draft,
        inputs,
      }),
    });
  }

  if (action.kind === "set-input-title") {
    const normalizedTitle = normalizeOptional(action.title);
    return updateInput(draft, action.inputId, (input) => {
      if (normalizeOptional(input.title) === normalizedTitle) {
        return input;
      }
      return Object.freeze({
        ...input,
        title: normalizedTitle,
      });
    });
  }

  if (action.kind === "add-input-dataset-asset") {
    const nextAssetId = buildNextDatasetAssetId(draft);
    const nextInput = buildDatasetInputFromAsset(draft, {
      assetId: nextAssetId,
      name: `Dataset input ${draft.inputs.length + 1}`,
    });
    return Object.freeze({
      changed: true,
      draft: Object.freeze({
        ...draft,
        inputs: Object.freeze([...draft.inputs, nextInput]),
      }),
    });
  }

  if (action.kind === "add-input-static-value") {
    const nextId = buildNextStaticInputId(draft);
    const inputs = Object.freeze([
      ...draft.inputs,
      Object.freeze({
        id: nextId,
        type: "static-value-input",
        title: `Static input ${draft.inputs.length + 1}`,
        sourceType: WorkflowDraftInputSourceTypes.staticValue,
        valueType: WorkflowDraftInputValueTypes.string,
        value: "",
        required: false,
      }),
    ]);
    return Object.freeze({
      changed: true,
      draft: Object.freeze({
        ...draft,
        inputs,
      }),
    });
  }

  if (action.kind === "remove-input") {
    const nextInputs = draft.inputs.filter((input) => input.id !== action.inputId);
    if (nextInputs.length === draft.inputs.length) {
      return Object.freeze({ draft, changed: false });
    }
    return Object.freeze({
      changed: true,
      draft: Object.freeze({
        ...draft,
        inputs: Object.freeze(nextInputs),
      }),
    });
  }

  if (action.kind === "add-step") {
    const definition = action.definitionKey
      ? getWorkflowStepTypeDefinitionByKey(action.definitionKey)
      : undefined;
    const result = definition ? addWorkflowStep(draft, definition) : addWorkflowStep(draft);
    return Object.freeze({ draft: result.draft, changed: true });
  }

  if (action.kind === "reorder-steps") {
    const result = reorderWorkflowSteps(draft, action.orderedStepIds);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "set-step-title") {
    const result = setWorkflowStepTitle(draft, action.stepId, action.title);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "add-step-dependency") {
    const result = addWorkflowStepDependency(draft, action.stepId, action.dependsOnStepId);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "remove-step-dependency") {
    const result = removeWorkflowStepDependency(draft, action.stepId, action.dependsOnStepId);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "remove-step") {
    const result = removeWorkflowStep(draft, action.stepId);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "add-output") {
    const result = addWorkflowOutput(
      draft,
      action.destinationType ?? WorkflowDraftOutputDestinationTypes.webViewer,
    );
    return Object.freeze({
      draft: result.draft,
      changed: result.added,
    });
  }

  if (action.kind === "set-output-title") {
    const result = setWorkflowOutputViewerTitle(draft, action.outputId, action.title);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  if (action.kind === "set-output-source-step") {
    const result = setWorkflowOutputSourceStep(draft, action.outputId, action.sourceStepId);
    return Object.freeze({ draft: result.draft, changed: result.changed });
  }

  const result = removeWorkflowOutput(draft, action.outputId);
  return Object.freeze({ draft: result.draft, changed: result.changed });
}

export function isWorkflowCanvasEditableSection(
  sectionId: WorkflowCanvasSectionId,
): boolean {
  return sectionId === WorkflowCanvasSectionIds.triggers
    || sectionId === WorkflowCanvasSectionIds.inputs
    || sectionId === WorkflowCanvasSectionIds.steps
    || sectionId === WorkflowCanvasSectionIds.outputs;
}
