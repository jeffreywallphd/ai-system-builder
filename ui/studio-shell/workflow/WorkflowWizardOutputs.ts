import {
  getWorkflowDraftOutputDestinationDefinition,
  listWorkflowDraftOutputDestinationDefinitions,
  WorkflowDraftOutputDestinationTypes,
  type WorkflowDraft,
  type WorkflowDraftOutput,
  type WorkflowDraftOutputDestinationDefinition,
  type WorkflowDraftOutputDestinationType,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";

export const WorkflowOutputPresentationModes = Object.freeze({
  embedded: "embedded",
  fullPage: "full-page",
});

export type WorkflowOutputPresentationMode =
  typeof WorkflowOutputPresentationModes[keyof typeof WorkflowOutputPresentationModes];

export const workflowOutputDestinationDefinitions: ReadonlyArray<WorkflowDraftOutputDestinationDefinition> =
  listWorkflowDraftOutputDestinationDefinitions();

const defaultOutputDestinationDefinition = workflowOutputDestinationDefinitions[0] as WorkflowDraftOutputDestinationDefinition;

export const workflowFileOutputFormats = Object.freeze(
  (getWorkflowDraftOutputDestinationDefinition(WorkflowDraftOutputDestinationTypes.fileExport)?.supportedFormats ?? []),
);

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
  destinationType: WorkflowDraftOutputDestinationType,
): WorkflowDraftOutputDestinationDefinition {
  return (getWorkflowDraftOutputDestinationDefinition(destinationType)
    ?? defaultOutputDestinationDefinition) as WorkflowDraftOutputDestinationDefinition;
}

function createDefaultOutputConfiguration(
  definition: WorkflowDraftOutputDestinationDefinition,
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
  definition: WorkflowDraftOutputDestinationDefinition,
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
  destinationType: WorkflowDraftOutputDestinationType,
): WorkflowDraftOutputDestinationDefinition {
  return getDestinationDefinition(destinationType);
}

export function addWorkflowOutput(
  draft: WorkflowDraft,
  destinationType: WorkflowDraftOutputDestinationType = WorkflowDraftOutputDestinationTypes.fileExport,
): { readonly draft: WorkflowDraft; readonly outputId: string } {
  const outputId = buildNextOutputId(draft);
  const destinationDefinition = getDestinationDefinition(destinationType);
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
    outputId,
    draft: Object.freeze({
      ...draft,
      outputs: Object.freeze([
        ...draft.outputs,
        baseOutput,
      ]),
    }),
  });
}

export function removeWorkflowOutput(
  draft: WorkflowDraft,
  outputId: string,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const nextOutputs = draft.outputs
    .filter((output) => output.id !== outputId)
    .map((output, index) => Object.freeze({
      ...output,
      order: index + 1,
    }));
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

export function setWorkflowOutputDestinationType(
  draft: WorkflowDraft,
  outputId: string,
  destinationType: WorkflowDraftOutputDestinationType,
): { readonly draft: WorkflowDraft; readonly changed: boolean } {
  const destinationDefinition = getDestinationDefinition(destinationType);
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
  if (output.destination.type === WorkflowDraftOutputDestinationTypes.fileExport) {
    if (!workflowFileOutputFormats.includes(output.format)) {
      messages.push("File Export output requires a valid file format.");
    }
  }
  if (output.destination.type === WorkflowDraftOutputDestinationTypes.webViewer) {
    if (!normalizeOptional(output.title)) {
      messages.push("Web Viewer output requires a viewer title.");
    }
  }
  if (output.destination.type === WorkflowDraftOutputDestinationTypes.systemEntry) {
    const entityName = readDestinationOptionString(output, "entityName");
    if (!entityName) {
      messages.push("Database/System Record output requires an entity name.");
    }
  }

  return Object.freeze(messages);
}

