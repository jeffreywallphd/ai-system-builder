import {
  WorkflowDraftOutputDestinationTypes,
  type WorkflowDraft,
  type WorkflowDraftOutput,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createDefaultWorkflowOutputTypeRegistry,
  type WorkflowOutputRegistryFieldMetadata,
  type WorkflowOutputTypeRegistryEntry,
} from "../../../application/workflow-studio/WorkflowOutputTypeRegistry";

export const WorkflowOutputPresentationModes = Object.freeze({
  embedded: "embedded",
  fullPage: "full-page",
});

export type WorkflowOutputPresentationMode =
  typeof WorkflowOutputPresentationModes[keyof typeof WorkflowOutputPresentationModes];

export interface WorkflowOutputAddRequest {
  readonly destinationType: string;
}

export interface WorkflowOutputAddResult {
  readonly draft: WorkflowDraft;
  readonly outputId?: string;
  readonly added: boolean;
  readonly error?: string;
}

export interface WorkflowOutputAddManyResult {
  readonly draft: WorkflowDraft;
  readonly addedOutputIds: ReadonlyArray<string>;
  readonly rejectedRequests: ReadonlyArray<{
    readonly destinationType: string;
    readonly error: string;
  }>;
}

export const workflowOutputTypeRegistry = createDefaultWorkflowOutputTypeRegistry();
export const workflowOutputTypeDefinitions: ReadonlyArray<WorkflowOutputTypeRegistryEntry> =
  workflowOutputTypeRegistry.list();

const defaultOutputTypeDefinition = workflowOutputTypeDefinitions[0] as WorkflowOutputTypeRegistryEntry;

export const workflowOutputDestinationDefinitions = workflowOutputTypeDefinitions;
export const workflowFileOutputFormats = Object.freeze([
  ...(workflowOutputTypeRegistry.get(WorkflowDraftOutputDestinationTypes.fileExport)?.supportedFormats ?? []),
]);

function normalizeOutputOrdering(outputs: ReadonlyArray<WorkflowDraftOutput>): ReadonlyArray<WorkflowDraftOutput> {
  return Object.freeze(outputs.map((output, index) => Object.freeze({
    ...output,
    order: index + 1,
  })));
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function buildNextOutputId(draft: WorkflowDraft): string {
  const existing = new Set(draft.outputs.map((entry) => entry.id));
  let index = draft.outputs.length + 1;
  let candidate = `output-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `output-${index}`;
  }
  return candidate;
}

function getDestinationDefinition(
  destinationType: string,
): WorkflowOutputTypeRegistryEntry | undefined {
  return workflowOutputTypeRegistry.get(destinationType);
}

function createDefaultOutputConfiguration(
  definition: WorkflowOutputTypeRegistryEntry,
): Readonly<Record<string, unknown>> | undefined {
  if (!definition.defaultConfiguration) {
    return undefined;
  }
  const configuration = { ...definition.defaultConfiguration };
  if (definition.destinationType === WorkflowDraftOutputDestinationTypes.webViewer) {
    configuration.presentationMode = WorkflowOutputPresentationModes.embedded;
  }
  return Object.freeze(configuration);
}

function applyDestinationDefinition(
  output: WorkflowDraftOutput,
  definition: WorkflowOutputTypeRegistryEntry,
): WorkflowDraftOutput {
  const configuration = createDefaultOutputConfiguration(definition);
  return Object.freeze({
    ...output,
    outputType: definition.outputType,
    format: definition.defaultFormat,
    configuration,
    title: definition.destinationType === WorkflowDraftOutputDestinationTypes.webViewer
      ? (typeof configuration?.title === "string" ? configuration.title : undefined)
      : undefined,
    destination: Object.freeze({
      type: definition.destinationType,
      target: definition.defaultTarget,
      options: configuration,
    }),
  });
}

function updateOutput(
  draft: WorkflowDraft,
  outputId: string,
  updater: (output: WorkflowDraftOutput) => WorkflowDraftOutput,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.outputs.findIndex((output) => output.id === outputId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }

  const current = draft.outputs[index] as WorkflowDraftOutput;
  const next = updater(current);
  if (next === current) {
    return Object.freeze({ draft, changed: false });
  }

  const nextOutputs = [...draft.outputs];
  nextOutputs[index] = next;
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      outputs: Object.freeze(nextOutputs),
    }),
    changed: true,
  });
}

function updateDestinationOptions(
  output: WorkflowDraftOutput,
  patch: Readonly<Record<string, unknown>>,
): WorkflowDraftOutput {
  const nextConfiguration = Object.freeze({
    ...(output.configuration ?? output.destination.options ?? {}),
    ...patch,
  });
  return Object.freeze({
    ...output,
    configuration: nextConfiguration,
    destination: Object.freeze({
      ...output.destination,
      options: nextConfiguration,
    }),
  });
}

function readDestinationOptionString(output: WorkflowDraftOutput, key: string): string | undefined {
  const candidate = output.configuration?.[key] ?? output.destination.options?.[key];
  if (typeof candidate !== "string") {
    return undefined;
  }
  return normalizeOptional(candidate);
}

export function getWorkflowOutputDestinationDefinitionByType(
  destinationType: string,
): WorkflowOutputTypeRegistryEntry {
  return getDestinationDefinition(destinationType)
    ?? defaultOutputTypeDefinition;
}

export function addWorkflowOutput(
  draft: WorkflowDraft,
  destinationType: string = WorkflowDraftOutputDestinationTypes.fileExport,
): WorkflowOutputAddResult {
  const addConstraint = workflowOutputTypeRegistry.evaluateAddConstraint(draft, destinationType);
  if (!addConstraint.allowed) {
    return Object.freeze({
      draft,
      added: false,
      error: addConstraint.message ?? `Workflow output type '${destinationType}' is not supported.`,
    });
  }

  const outputId = buildNextOutputId(draft);
  const destinationDefinition = getDestinationDefinition(destinationType);
  if (!destinationDefinition) {
    return Object.freeze({
      draft,
      added: false,
      error: `Workflow output type '${destinationType}' is not registered.`,
    });
  }

  const configuration = createDefaultOutputConfiguration(destinationDefinition);
  const baseOutput: WorkflowDraftOutput = Object.freeze({
    id: outputId,
    type: "workflow-output",
    title: destinationType === WorkflowDraftOutputDestinationTypes.webViewer
      ? (typeof configuration?.title === "string" ? configuration.title : undefined)
      : undefined,
    order: draft.outputs.length + 1,
    outputType: destinationDefinition.outputType,
    format: destinationDefinition.defaultFormat,
    configuration,
    destination: Object.freeze({
      type: destinationDefinition.destinationType,
      target: destinationDefinition.defaultTarget,
      options: configuration,
    }),
  });

  return Object.freeze({
    added: true,
    outputId,
    draft: Object.freeze({
      ...draft,
      outputs: normalizeOutputOrdering([
        ...draft.outputs,
        baseOutput,
      ]),
    }),
  });
}

export function addWorkflowOutputs(
  draft: WorkflowDraft,
  destinationTypes: ReadonlyArray<string>,
): WorkflowOutputAddManyResult {
  const addedOutputIds: string[] = [];
  const rejectedRequests: Array<{ readonly destinationType: string; readonly error: string }> = [];
  let nextDraft = draft;

  for (const rawDestinationType of destinationTypes) {
    const destinationType = normalizeOptional(rawDestinationType);
    if (!destinationType) {
      rejectedRequests.push(Object.freeze({
        destinationType: String(rawDestinationType ?? ""),
        error: "Workflow output add request requires a destination type.",
      }));
      continue;
    }

    const result = addWorkflowOutput(nextDraft, destinationType);
    if (!result.added || !result.outputId) {
      rejectedRequests.push(Object.freeze({
        destinationType,
        error: result.error ?? `Unable to add output '${destinationType}'.`,
      }));
      continue;
    }

    nextDraft = result.draft;
    addedOutputIds.push(result.outputId);
  }

  return Object.freeze({
    draft: nextDraft,
    addedOutputIds: Object.freeze(addedOutputIds),
    rejectedRequests: Object.freeze(rejectedRequests),
  });
}

export function removeWorkflowOutput(
  draft: WorkflowDraft,
  outputId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const nextOutputs = normalizeOutputOrdering(draft.outputs.filter((output) => output.id !== outputId));
  if (nextOutputs.length === draft.outputs.length) {
    return Object.freeze({ draft, changed: false });
  }
  return Object.freeze({
    draft: Object.freeze({
      ...draft,
      outputs: Object.freeze(nextOutputs),
    }),
    changed: true,
  });
}

function moveWorkflowOutput(
  draft: WorkflowDraft,
  outputId: string,
  offset: -1 | 1,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const index = draft.outputs.findIndex((output) => output.id === outputId);
  if (index < 0) {
    return Object.freeze({ draft, changed: false });
  }
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= draft.outputs.length) {
    return Object.freeze({ draft, changed: false });
  }

  const nextOutputs = [...draft.outputs];
  [nextOutputs[index], nextOutputs[targetIndex]] = [
    nextOutputs[targetIndex] as WorkflowDraftOutput,
    nextOutputs[index] as WorkflowDraftOutput,
  ];

  return Object.freeze({
    changed: true,
    draft: Object.freeze({
      ...draft,
      outputs: normalizeOutputOrdering(nextOutputs),
    }),
  });
}

export function moveWorkflowOutputUp(
  draft: WorkflowDraft,
  outputId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveWorkflowOutput(draft, outputId, -1);
}

export function moveWorkflowOutputDown(
  draft: WorkflowDraft,
  outputId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return moveWorkflowOutput(draft, outputId, 1);
}

export function canMoveWorkflowOutput(
  draft: WorkflowDraft,
  outputId: string,
  direction: "up" | "down",
): boolean {
  const index = draft.outputs.findIndex((output) => output.id === outputId);
  if (index < 0) {
    return false;
  }
  if (direction === "up") {
    return index > 0;
  }
  return index < draft.outputs.length - 1;
}

export function resolveWorkflowOutputSelectionId(
  draft: WorkflowDraft,
  preferredOutputId?: string,
): string | undefined {
  const normalizedPreferred = normalizeOptional(preferredOutputId);
  if (normalizedPreferred && draft.outputs.some((output) => output.id === normalizedPreferred)) {
    return normalizedPreferred;
  }
  return draft.outputs[0]?.id;
}

export function getWorkflowOutputIssuesForIndex(
  draftValidationIssues: ReadonlyArray<{ readonly path?: string; readonly message: string }>,
  index: number,
): ReadonlyArray<string> {
  return Object.freeze(draftValidationIssues
    .filter((issue) => issue.path?.startsWith(`draft.outputs[${index}]`))
    .map((issue) => issue.message));
}

function resolveOutputLabel(output: WorkflowDraftOutput): string {
  const definition = getDestinationDefinition(output.destination.type);
  return definition?.label ?? output.destination.type;
}

export function setWorkflowOutputDestinationType(
  draft: WorkflowDraft,
  outputId: string,
  destinationType: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const destinationDefinition = getDestinationDefinition(destinationType);
  if (!destinationDefinition) {
    return Object.freeze({ draft, changed: false });
  }
  return updateOutput(draft, outputId, (current) => {
    if (current.destination.type === destinationType) {
      return current;
    }
    return applyDestinationDefinition(current, destinationDefinition);
  });
}

export function setWorkflowOutputFormat(
  draft: WorkflowDraft,
  outputId: string,
  format: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const normalized = normalizeOptional(format);
  if (!normalized) {
    return Object.freeze({ draft, changed: false });
  }

  return updateOutput(draft, outputId, (current) => {
    if (current.format === normalized) {
      return current;
    }
    return Object.freeze({
      ...current,
      format: normalized,
    });
  });
}

export function setWorkflowOutputViewerTitle(
  draft: WorkflowDraft,
  outputId: string,
  title: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateOutput(draft, outputId, (current) => {
    const normalized = normalizeOptional(title);
    const existingTitle = current.title;
    const existingConfigTitle = readDestinationOptionString(current, "title");
    if (existingTitle === normalized && existingConfigTitle === normalized) {
      return current;
    }
    return updateDestinationOptions(Object.freeze({
      ...current,
      title: normalized,
    }), {
      title: normalized ?? "",
    });
  });
}

export function setWorkflowOutputFileName(
  draft: WorkflowDraft,
  outputId: string,
  fileName: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateOutput(draft, outputId, (current) => {
    const normalized = normalizeOptional(fileName) ?? "";
    const existing = readDestinationOptionString(current, "fileName") ?? "";
    if (existing === normalized) {
      return current;
    }
    return updateDestinationOptions(current, {
      fileName: normalized,
    });
  });
}

export function setWorkflowOutputViewerPresentationMode(
  draft: WorkflowDraft,
  outputId: string,
  presentationMode: WorkflowOutputPresentationMode,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateOutput(draft, outputId, (current) => {
    const existing = readDestinationOptionString(current, "presentationMode");
    if (existing === presentationMode) {
      return current;
    }
    return updateDestinationOptions(current, {
      presentationMode,
    });
  });
}

export function setWorkflowOutputRecordEntityName(
  draft: WorkflowDraft,
  outputId: string,
  entityName: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateOutput(draft, outputId, (current) => {
    const normalized = normalizeOptional(entityName) ?? "";
    const existing = readDestinationOptionString(current, "entityName") ?? "";
    if (existing === normalized) {
      return current;
    }
    return updateDestinationOptions(current, {
      entityName: normalized,
    });
  });
}

export function setWorkflowOutputRecordDestinationConfig(
  draft: WorkflowDraft,
  outputId: string,
  destinationConfig: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  return updateOutput(draft, outputId, (current) => {
    const normalized = normalizeOptional(destinationConfig) ?? "";
    const existing = readDestinationOptionString(current, "destinationConfig") ?? "";
    if (existing === normalized) {
      return current;
    }
    return updateDestinationOptions(current, {
      destinationConfig: normalized,
    });
  });
}

export function getWorkflowOutputValidationMessages(
  output: WorkflowDraftOutput,
): ReadonlyArray<string> {
  const messages: string[] = [];
  const destinationDefinition = getDestinationDefinition(output.destination.type);
  if (!destinationDefinition) {
    messages.push(`Workflow output type '${output.destination.type}' is not registered.`);
    return Object.freeze(messages);
  }

  if (!destinationDefinition.supportedFormats.includes(output.format)) {
    if (destinationDefinition.destinationType === WorkflowDraftOutputDestinationTypes.fileExport) {
      messages.push("File Export output requires a valid file format.");
    } else {
      messages.push(`${resolveOutputLabel(output)} output format '${output.format}' is not supported.`);
    }
  }

  if (destinationDefinition.destinationType === WorkflowDraftOutputDestinationTypes.webViewer) {
    if (!normalizeOptional(output.title)) {
      messages.push("Web Viewer output requires a viewer title.");
    }
  }
  if (destinationDefinition.destinationType === WorkflowDraftOutputDestinationTypes.systemEntry) {
    const entityName = readDestinationOptionString(output, "entityName");
    if (!entityName) {
      messages.push("Database/System Record output requires an entity name.");
    }
  }

  return Object.freeze(messages);
}

export function readWorkflowOutputFieldValue(
  output: WorkflowDraftOutput,
  field: WorkflowOutputRegistryFieldMetadata,
): string {
  if (field.target === "format") {
    return output.format;
  }
  if (field.target === "title") {
    return output.title ?? "";
  }
  return readDestinationOptionString(output, field.key) ?? "";
}

export function setWorkflowOutputFieldValue(
  draft: WorkflowDraft,
  outputId: string,
  field: WorkflowOutputRegistryFieldMetadata,
  value: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  if (field.target === "format") {
    return setWorkflowOutputFormat(draft, outputId, value);
  }
  if (field.target === "title") {
    return setWorkflowOutputViewerTitle(draft, outputId, value);
  }
  if (field.key === "fileName") {
    return setWorkflowOutputFileName(draft, outputId, value);
  }
  if (field.key === "presentationMode") {
    return setWorkflowOutputViewerPresentationMode(draft, outputId, value as WorkflowOutputPresentationMode);
  }
  if (field.key === "entityName") {
    return setWorkflowOutputRecordEntityName(draft, outputId, value);
  }
  if (field.key === "destinationConfig") {
    return setWorkflowOutputRecordDestinationConfig(draft, outputId, value);
  }
  return Object.freeze({ draft, changed: false });
}

