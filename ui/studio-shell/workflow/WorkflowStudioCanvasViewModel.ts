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
  readonly totalNodeCount: number;
  readonly totalIssueCount: number;
}

export type WorkflowCanvasAction =
  | { readonly kind: "add-trigger"; readonly triggerType?: WorkflowDraftTriggerType }
  | { readonly kind: "set-trigger-title"; readonly triggerId: string; readonly title: string }
  | { readonly kind: "remove-trigger"; readonly triggerId: string }
  | { readonly kind: "add-input-runtime-parameter" }
  | { readonly kind: "set-input-title"; readonly inputId: string; readonly title: string }
  | { readonly kind: "remove-input"; readonly inputId: string }
  | { readonly kind: "add-step" }
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

  return Object.freeze({
    sections,
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
    const result = addWorkflowStep(draft);
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
