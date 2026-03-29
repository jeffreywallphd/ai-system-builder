import {
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftOutputFormats,
  WorkflowDraftOutputTypes,
  type WorkflowDraft,
  type WorkflowDraftOutput,
  type WorkflowDraftOutputDestinationType,
} from "../../../domain/workflow-studio/WorkflowStudioDomain";

export const WorkflowOutputPresentationModes = Object.freeze({
  embedded: "embedded",
  fullPage: "full-page",
});

export type WorkflowOutputPresentationMode =
  typeof WorkflowOutputPresentationModes[keyof typeof WorkflowOutputPresentationModes];

export interface WorkflowOutputDestinationDefinition {
  readonly destinationType: WorkflowDraftOutputDestinationType;
  readonly label: string;
  readonly summary: string;
  readonly outputType: string;
  readonly defaultFormat: string;
  readonly defaultTarget: string;
  readonly defaultOptions?: Readonly<Record<string, unknown>>;
}

export const workflowOutputDestinationDefinitions: ReadonlyArray<WorkflowOutputDestinationDefinition> = Object.freeze([
  Object.freeze({
    destinationType: WorkflowDraftOutputDestinationTypes.fileExport,
    label: "File Export",
    summary: "Generate downloadable files such as PDF exports.",
    outputType: WorkflowDraftOutputTypes.document,
    defaultFormat: "pdf",
    defaultTarget: "file-download",
    defaultOptions: Object.freeze({
      fileName: "",
    }),
  }),
  Object.freeze({
    destinationType: WorkflowDraftOutputDestinationTypes.webViewer,
    label: "Web Viewer / In-App View",
    summary: "Render output directly inside the studio/web viewer.",
    outputType: WorkflowDraftOutputTypes.document,
    defaultFormat: WorkflowDraftOutputFormats.markdown,
    defaultTarget: "in-app-view",
    defaultOptions: Object.freeze({
      presentationMode: WorkflowOutputPresentationModes.embedded,
    }),
  }),
  Object.freeze({
    destinationType: WorkflowDraftOutputDestinationTypes.systemEntry,
    label: "Database / System Record",
    summary: "Persist output as a system entity/record destination.",
    outputType: WorkflowDraftOutputTypes.record,
    defaultFormat: WorkflowDraftOutputFormats.json,
    defaultTarget: "system-record",
    defaultOptions: Object.freeze({
      entityName: "",
      destinationConfig: "",
    }),
  }),
]);

const defaultOutputDestinationDefinition = workflowOutputDestinationDefinitions[0] as WorkflowOutputDestinationDefinition;

export const workflowFileOutputFormats = Object.freeze([
  "pdf",
  WorkflowDraftOutputFormats.json,
  WorkflowDraftOutputFormats.jsonl,
  WorkflowDraftOutputFormats.csv,
  WorkflowDraftOutputFormats.markdown,
  WorkflowDraftOutputFormats.html,
]);

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
): WorkflowOutputDestinationDefinition {
  return (workflowOutputDestinationDefinitions.find((entry) => entry.destinationType === destinationType)
    ?? defaultOutputDestinationDefinition) as WorkflowOutputDestinationDefinition;
}

function createDefaultDestinationOptions(
  definition: WorkflowOutputDestinationDefinition,
): Readonly<Record<string, unknown>> | undefined {
  if (!definition.defaultOptions) {
    return undefined;
  }
  return Object.freeze({ ...definition.defaultOptions });
}

function applyDestinationDefinition(
  output: WorkflowDraftOutput,
  definition: WorkflowOutputDestinationDefinition,
): WorkflowDraftOutput {
  return Object.freeze({
    ...output,
    outputType: definition.outputType,
    format: definition.defaultFormat,
    destination: Object.freeze({
      type: definition.destinationType,
      target: definition.defaultTarget,
      options: createDefaultDestinationOptions(definition),
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
  return Object.freeze({
    ...output,
    destination: Object.freeze({
      ...output.destination,
      options: Object.freeze({
        ...(output.destination.options ?? {}),
        ...patch,
      }),
    }),
  });
}

function readDestinationOptionString(output: WorkflowDraftOutput, key: string): string | undefined {
  const candidate = output.destination.options?.[key];
  if (typeof candidate !== "string") {
    return undefined;
  }
  return normalizeOptional(candidate);
}

export function getWorkflowOutputDestinationDefinitionByType(
  destinationType: WorkflowDraftOutputDestinationType,
): WorkflowOutputDestinationDefinition {
  return getDestinationDefinition(destinationType);
}

export function addWorkflowOutput(
  draft: WorkflowDraft,
  destinationType: WorkflowDraftOutputDestinationType = WorkflowDraftOutputDestinationTypes.fileExport,
): { readonly draft: WorkflowDraft; readonly outputId: string } {
  const outputId = buildNextOutputId(draft);
  const destinationDefinition = getDestinationDefinition(destinationType);
  const baseOutput: WorkflowDraftOutput = Object.freeze({
    id: outputId,
    type: "workflow-output",
    title: undefined,
    outputType: destinationDefinition.outputType,
    format: destinationDefinition.defaultFormat,
    destination: Object.freeze({
      type: destinationDefinition.destinationType,
      target: destinationDefinition.defaultTarget,
      options: createDefaultDestinationOptions(destinationDefinition),
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
  const nextOutputs = draft.outputs.filter((output) => output.id !== outputId);
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
    if (current.title === normalized) {
      return current;
    }
    return Object.freeze({
      ...current,
      title: normalized,
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

