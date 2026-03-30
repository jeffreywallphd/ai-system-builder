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
  addWorkflowStep,
  getWorkflowStepTypeDefinitionByKey,
  removeWorkflowStep,
  resolveWorkflowStepTypeDefinition,
  setWorkflowStepTitle,
} from "./WorkflowWizardSteps";
import {
  addWorkflowOutput,
  getWorkflowOutputDestinationDefinitionByType,
  listWorkflowOutputSummaries,
  removeWorkflowOutput,
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
  readonly position: WorkflowCanvasGraphPosition;
}

export interface WorkflowCanvasGraphEdgeViewModel {
  readonly id: string;
  readonly kind: WorkflowCanvasGraphEdgeKind;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
}

export interface WorkflowCanvasGraphLayoutViewModel {
  readonly sectionColumnWidth: number;
  readonly sectionNodeHeight: number;
  readonly itemRowHeight: number;
  readonly itemNodeOffsetY: number;
}

export interface WorkflowCanvasGraphViewModel {
  readonly nodes: ReadonlyArray<WorkflowCanvasGraphNodeViewModel>;
  readonly edges: ReadonlyArray<WorkflowCanvasGraphEdgeViewModel>;
  readonly layout: WorkflowCanvasGraphLayoutViewModel;
}

const WorkflowCanvasGraphLayout = Object.freeze({
  sectionColumnWidth: 360,
  sectionNodeHeight: 120,
  itemRowHeight: 176,
  itemNodeOffsetY: 156,
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

function deriveWorkflowCanvasGraphViewModel(
  sections: ReadonlyArray<WorkflowCanvasSectionViewModel>,
): WorkflowCanvasGraphViewModel {
  const graphNodes: WorkflowCanvasGraphNodeViewModel[] = [];
  const graphEdges: WorkflowCanvasGraphEdgeViewModel[] = [];
  const sectionEntryNodeIds = new Map<WorkflowCanvasSectionId, string>();
  const sectionExitNodeIds = new Map<WorkflowCanvasSectionId, string>();

  sections.forEach((section, sectionIndex) => {
    const sectionNodeId = buildSectionGraphNodeId(section.id);
    graphNodes.push(Object.freeze({
      id: sectionNodeId,
      kind: WorkflowCanvasGraphNodeKinds.section,
      sectionId: section.id,
      entityId: undefined,
      title: section.title,
      subtitle: section.summary,
      detailLines: Object.freeze([`${section.nodes.length} node(s)`]),
      issueCount: section.nodes.reduce((sum, node) => sum + node.issueMessages.length, 0),
      position: Object.freeze({
        x: sectionIndex * WorkflowCanvasGraphLayout.sectionColumnWidth,
        y: 0,
      }),
    }));

    if (section.nodes.length === 0) {
      sectionEntryNodeIds.set(section.id, sectionNodeId);
      sectionExitNodeIds.set(section.id, sectionNodeId);
      return;
    }

    let previousItemNodeId: string | undefined;
    section.nodes.forEach((node, nodeIndex) => {
      const itemNodeId = buildItemGraphNodeId(node);
      const issueCount = node.issueMessages.length;
      graphNodes.push(Object.freeze({
        id: itemNodeId,
        kind: WorkflowCanvasGraphNodeKinds.item,
        sectionId: section.id,
        entityId: node.id,
        title: node.title,
        subtitle: node.subtitle,
        detailLines: node.detailLines,
        issueCount,
        position: Object.freeze({
          x: sectionIndex * WorkflowCanvasGraphLayout.sectionColumnWidth,
          y: WorkflowCanvasGraphLayout.itemNodeOffsetY + (nodeIndex * WorkflowCanvasGraphLayout.itemRowHeight),
        }),
      }));

      if (nodeIndex === 0) {
        graphEdges.push(Object.freeze({
          id: buildGraphEdgeId(sectionNodeId, itemNodeId),
          kind: WorkflowCanvasGraphEdgeKinds.sectionEntry,
          sourceNodeId: sectionNodeId,
          targetNodeId: itemNodeId,
        }));
        sectionEntryNodeIds.set(section.id, itemNodeId);
      }

      if (previousItemNodeId) {
        graphEdges.push(Object.freeze({
          id: buildGraphEdgeId(previousItemNodeId, itemNodeId),
          kind: WorkflowCanvasGraphEdgeKinds.itemSequence,
          sourceNodeId: previousItemNodeId,
          targetNodeId: itemNodeId,
        }));
      }

      previousItemNodeId = itemNodeId;
      sectionExitNodeIds.set(section.id, itemNodeId);
    });
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
  | { readonly kind: "set-step-title"; readonly stepId: string; readonly title: string }
  | { readonly kind: "remove-step"; readonly stepId: string }
  | { readonly kind: "add-output"; readonly destinationType?: WorkflowDraftOutputDestinationType }
  | { readonly kind: "set-output-title"; readonly outputId: string; readonly title: string }
  | { readonly kind: "remove-output"; readonly outputId: string };

export interface WorkflowCanvasActionResult {
  readonly draft: WorkflowDraft;
  readonly changed: boolean;
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
  const graph = deriveWorkflowCanvasGraphViewModel(sections);

  return Object.freeze({
    sections,
    graph,
    totalNodeCount: sections.reduce((sum, section) => sum + section.nodes.length, 0),
    totalIssueCount: sections.reduce((sum, section) => (
      sum + section.nodes.reduce((sectionSum, node) => sectionSum + node.issueMessages.length, 0)
    ), 0),
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

  if (action.kind === "set-step-title") {
    const result = setWorkflowStepTitle(draft, action.stepId, action.title);
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
