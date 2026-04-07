import {
  listWorkflowDraftOutputDestinationDefinitions,
  WorkflowDraftOutputDestinationTypes,
  WorkflowDraftSystemOutputRecordShapes,
  WorkflowDraftSystemOutputWriteModes,
  type WorkflowDraft,
  type WorkflowDraftOutputDestinationDefinition,
  type WorkflowDraftOutputDestinationType,
} from "@domain/workflow-studio/WorkflowStudioDomain";

export const WorkflowOutputRegistryMultiplicityPolicies = Object.freeze({
  allowMultiple: "allow-multiple",
  singleInstance: "single-instance",
});

export type WorkflowOutputRegistryMultiplicityPolicy =
  typeof WorkflowOutputRegistryMultiplicityPolicies[keyof typeof WorkflowOutputRegistryMultiplicityPolicies];

export const WorkflowOutputRegistryFieldKinds = Object.freeze({
  format: "format",
  text: "text",
  select: "select",
});

export type WorkflowOutputRegistryFieldKind =
  typeof WorkflowOutputRegistryFieldKinds[keyof typeof WorkflowOutputRegistryFieldKinds];

export const WorkflowOutputRegistryFieldTargets = Object.freeze({
  format: "format",
  title: "title",
  configuration: "configuration",
});

export type WorkflowOutputRegistryFieldTarget =
  typeof WorkflowOutputRegistryFieldTargets[keyof typeof WorkflowOutputRegistryFieldTargets];

export interface WorkflowOutputRegistryFieldOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export interface WorkflowOutputRegistryFieldMetadata {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly target: WorkflowOutputRegistryFieldTarget;
  readonly kind: WorkflowOutputRegistryFieldKind;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<WorkflowOutputRegistryFieldOption>;
}

export interface WorkflowOutputRegistryCapabilities {
  readonly supportsAssetDelivery: boolean;
  readonly supportsInteractiveViewer: boolean;
  readonly supportsSystemRecordPersistence: boolean;
  readonly supportsExecutionReview: boolean;
  readonly supportsConversationalOutput: boolean;
}

export interface WorkflowOutputRegistryConversationalMetadata {
  readonly mode: "prompt-response";
  readonly supportsContinuation: boolean;
  readonly promptInputLinkKey: string;
  readonly responseFieldKey: string;
  readonly scopeFieldKey: string;
}

export interface WorkflowOutputRegistryMultiplicity {
  readonly policy: WorkflowOutputRegistryMultiplicityPolicy;
  readonly maxInstances?: number;
}

export interface WorkflowOutputTypeRegistryEntry {
  readonly destinationType: WorkflowDraftOutputDestinationType;
  readonly outputType: WorkflowDraftOutputDestinationDefinition["outputType"];
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly supportedFormats: ReadonlyArray<string>;
  readonly defaultFormat: string;
  readonly defaultTarget: string;
  readonly defaultConfiguration?: Readonly<Record<string, unknown>>;
  readonly capabilities: WorkflowOutputRegistryCapabilities;
  readonly conversational?: WorkflowOutputRegistryConversationalMetadata;
  readonly multiplicity: WorkflowOutputRegistryMultiplicity;
  readonly configurationFields: ReadonlyArray<WorkflowOutputRegistryFieldMetadata>;
}

export interface WorkflowOutputTypeAddConstraint {
  readonly allowed: boolean;
  readonly reasonCode?: "unsupported-type" | "max-instances-reached";
  readonly message?: string;
}

function freezeRecord(
  value?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze({ ...value });
}

function toRegistryEntry(definition: WorkflowDraftOutputDestinationDefinition): WorkflowOutputTypeRegistryEntry {
  const base = Object.freeze({
    destinationType: definition.destinationType,
    outputType: definition.outputType,
    label: definition.label,
    description: definition.description,
    configSchemaId: definition.configSchemaId,
    supportedFormats: Object.freeze([...(definition.supportedFormats ?? [])]),
    defaultFormat: definition.defaultFormat,
    defaultTarget: definition.defaultTarget,
    defaultConfiguration: freezeRecord(definition.defaultConfiguration),
    multiplicity: Object.freeze({
      policy: WorkflowOutputRegistryMultiplicityPolicies.allowMultiple,
    }),
    capabilities: Object.freeze({
      supportsAssetDelivery: false,
      supportsInteractiveViewer: false,
      supportsSystemRecordPersistence: false,
      supportsExecutionReview: true,
      supportsConversationalOutput: false,
    }),
    conversational: undefined,
    configurationFields: Object.freeze([] as WorkflowOutputRegistryFieldMetadata[]),
  });

  if (definition.destinationType === WorkflowDraftOutputDestinationTypes.fileExport) {
    return Object.freeze({
      ...base,
      capabilities: Object.freeze({
        ...base.capabilities,
        supportsAssetDelivery: true,
      }),
      configurationFields: Object.freeze([
        Object.freeze({
          key: "format",
          label: "File format",
          target: WorkflowOutputRegistryFieldTargets.format,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze(
            (definition.supportedFormats ?? []).map((format) => Object.freeze({
              value: format,
              label: String(format).toUpperCase(),
            })),
          ),
        }),
        Object.freeze({
          key: "deliveryMode",
          label: "Delivery mode",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: "download",
              label: "Download file",
            }),
            Object.freeze({
              value: "workspace-file",
              label: "Workspace file",
            }),
          ]),
        }),
        Object.freeze({
          key: "destinationPath",
          label: "Destination path",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: false,
          placeholder: "exports/report.json",
          description: "Required when delivery mode is 'Workspace file'.",
        }),
        Object.freeze({
          key: "fileName",
          label: "File/display name (optional)",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: false,
          placeholder: "Quarterly report",
          description: "Optional file display name.",
        }),
      ]),
    });
  }

  if (definition.destinationType === WorkflowDraftOutputDestinationTypes.webViewer) {
    return Object.freeze({
      ...base,
      capabilities: Object.freeze({
        ...base.capabilities,
        supportsInteractiveViewer: true,
      }),
      configurationFields: Object.freeze([
        Object.freeze({
          key: "title",
          label: "Viewer title",
          target: WorkflowOutputRegistryFieldTargets.title,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: true,
          placeholder: "Workflow result view",
        }),
        Object.freeze({
          key: "presentationMode",
          label: "Presentation mode",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: "embedded",
              label: "Embedded",
            }),
            Object.freeze({
              value: "full-page",
              label: "Full page",
            }),
          ]),
        }),
      ]),
    });
  }

  if (definition.destinationType === WorkflowDraftOutputDestinationTypes.systemEntry) {
    return Object.freeze({
      ...base,
      capabilities: Object.freeze({
        ...base.capabilities,
        supportsSystemRecordPersistence: true,
      }),
      configurationFields: Object.freeze([
        Object.freeze({
          key: "entityName",
          label: "Record entity",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: true,
          placeholder: "customer.record",
        }),
        Object.freeze({
          key: "recordCollection",
          label: "Record collection",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: false,
          placeholder: "records/customers",
        }),
        Object.freeze({
          key: "writeMode",
          label: "Write mode",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: WorkflowDraftSystemOutputWriteModes.upsert,
              label: "Upsert",
              description: "Create missing records and update matching records.",
            }),
            Object.freeze({
              value: WorkflowDraftSystemOutputWriteModes.append,
              label: "Append only",
              description: "Create new records without updating existing ones.",
            }),
          ]),
        }),
        Object.freeze({
          key: "recordShape",
          label: "Record shape",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: WorkflowDraftSystemOutputRecordShapes.singleRecord,
              label: "Single record",
            }),
            Object.freeze({
              value: WorkflowDraftSystemOutputRecordShapes.recordCollection,
              label: "Record collection",
            }),
          ]),
        }),
        Object.freeze({
          key: "includeExecutionMetadata",
          label: "Include execution metadata",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: "true",
              label: "Yes",
            }),
            Object.freeze({
              value: "false",
              label: "No",
            }),
          ]),
        }),
      ]),
    });
  }

  if (definition.destinationType === WorkflowDraftOutputDestinationTypes.promptResponseChat) {
    return Object.freeze({
      ...base,
      capabilities: Object.freeze({
        ...base.capabilities,
        supportsInteractiveViewer: true,
        supportsConversationalOutput: true,
      }),
      conversational: Object.freeze({
        mode: "prompt-response",
        supportsContinuation: true,
        promptInputLinkKey: "promptInputId",
        responseFieldKey: "responseField",
        scopeFieldKey: "conversationScope",
      }),
      configurationFields: Object.freeze([
        Object.freeze({
          key: "title",
          label: "Chat title",
          target: WorkflowOutputRegistryFieldTargets.title,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: true,
          placeholder: "Workflow chat response",
        }),
        Object.freeze({
          key: "promptInputId",
          label: "Prompt input id",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: true,
          placeholder: "input-user-prompt",
          description: "Links the conversational output to a prompt-oriented workflow input id.",
        }),
        Object.freeze({
          key: "responseField",
          label: "Initial response field",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: true,
          placeholder: "assistant-response",
          description: "Field key that stores the initial assistant response payload.",
        }),
        Object.freeze({
          key: "conversationScope",
          label: "Conversation scope",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.select,
          required: true,
          options: Object.freeze([
            Object.freeze({
              value: "continue-session",
              label: "Continue session",
            }),
            Object.freeze({
              value: "new-session",
              label: "New session",
            }),
          ]),
        }),
        Object.freeze({
          key: "initialSystemPrompt",
          label: "Initial system prompt (optional)",
          target: WorkflowOutputRegistryFieldTargets.configuration,
          kind: WorkflowOutputRegistryFieldKinds.text,
          required: false,
          placeholder: "You are a concise assistant.",
        }),
      ]),
    });
  }

  return base;
}

export class WorkflowOutputTypeRegistry {
  private readonly byDestinationType = new Map<WorkflowDraftOutputDestinationType, WorkflowOutputTypeRegistryEntry>();
  private readonly entries: ReadonlyArray<WorkflowOutputTypeRegistryEntry>;

  public constructor(
    definitions: ReadonlyArray<WorkflowDraftOutputDestinationDefinition> = listWorkflowDraftOutputDestinationDefinitions(),
  ) {
    for (const definition of definitions) {
      if (this.byDestinationType.has(definition.destinationType)) {
        throw new Error(`Workflow output type '${definition.destinationType}' is already registered.`);
      }
      this.byDestinationType.set(definition.destinationType, toRegistryEntry(definition));
    }
    this.entries = Object.freeze(definitions.map((definition) => toRegistryEntry(definition)));
  }

  public list(): ReadonlyArray<WorkflowOutputTypeRegistryEntry> {
    return this.entries;
  }

  public get(destinationType: string): WorkflowOutputTypeRegistryEntry | undefined {
    const normalizedDestinationType = destinationType.trim();
    if (!normalizedDestinationType) {
      return undefined;
    }

    return this.byDestinationType.get(normalizedDestinationType);
  }

  public isSupported(destinationType: string): boolean {
    return this.get(destinationType) !== undefined;
  }

  public evaluateAddConstraint(
    draft: WorkflowDraft,
    destinationType: string,
  ): WorkflowOutputTypeAddConstraint {
    const entry = this.get(destinationType);
    if (!entry) {
      return Object.freeze({
        allowed: false,
        reasonCode: "unsupported-type",
        message: `Workflow output type '${destinationType}' is not registered.`,
      });
    }

    const maxInstances = entry.multiplicity.maxInstances;
    if (entry.multiplicity.policy === WorkflowOutputRegistryMultiplicityPolicies.singleInstance) {
      const existingCount = draft.outputs.filter((output) => output.destination.type === entry.destinationType).length;
      if (existingCount >= (maxInstances ?? 1)) {
        return Object.freeze({
          allowed: false,
          reasonCode: "max-instances-reached",
          message: `${entry.label} supports at most ${maxInstances ?? 1} instance(s).`,
        });
      }
    }

    return Object.freeze({
      allowed: true,
    });
  }
}

export function createDefaultWorkflowOutputTypeRegistry(): WorkflowOutputTypeRegistry {
  return new WorkflowOutputTypeRegistry();
}

