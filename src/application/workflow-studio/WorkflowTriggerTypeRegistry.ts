import {
  getWorkflowDraftTriggerDefinition,
  listWorkflowDraftTriggerDefinitions,
  type WorkflowDraftTriggerConfig,
  type WorkflowDraftTriggerDefinition,
  type WorkflowDraftTriggerKind,
  type WorkflowDraftTriggerType,
} from "@domain/workflow-studio/WorkflowStudioDomain";
import { validateWorkflowTriggerTypeConfig } from "./WorkflowTriggerValidationPipeline";

export interface WorkflowTriggerTypeRegistryEntry {
  readonly kind: WorkflowDraftTriggerKind;
  readonly type: WorkflowDraftTriggerType;
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly capabilities: WorkflowDraftTriggerDefinition["capabilities"];
  readonly defaultConfig: Readonly<WorkflowDraftTriggerConfig>;
  readonly validationEntryPoint: "normalizeWorkflowDraftTriggerConfig";
}

function assertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function toRegistryEntry(definition: WorkflowDraftTriggerDefinition): WorkflowTriggerTypeRegistryEntry {
  return Object.freeze({
    kind: definition.kind,
    type: definition.type,
    label: definition.label,
    description: definition.description,
    configSchemaId: definition.configSchemaId,
    capabilities: definition.capabilities,
    defaultConfig: Object.freeze({ ...definition.defaultConfig }) as Readonly<WorkflowDraftTriggerConfig>,
    validationEntryPoint: "normalizeWorkflowDraftTriggerConfig",
  });
}

export class WorkflowTriggerTypeRegistry {
  private readonly byType = new Map<WorkflowDraftTriggerType, WorkflowDraftTriggerDefinition>();
  private readonly entries: ReadonlyArray<WorkflowTriggerTypeRegistryEntry>;

  public constructor(
    definitions: ReadonlyArray<WorkflowDraftTriggerDefinition> = listWorkflowDraftTriggerDefinitions(),
  ) {
    for (const definition of definitions) {
      if (this.byType.has(definition.type)) {
        throw new Error(`Workflow trigger type '${definition.type}' is already registered.`);
      }
      this.byType.set(definition.type, definition);
    }

    this.entries = Object.freeze(definitions.map((definition) => toRegistryEntry(definition)));
  }

  public list(): ReadonlyArray<WorkflowTriggerTypeRegistryEntry> {
    return this.entries;
  }

  public listByKind(kind: WorkflowDraftTriggerKind): ReadonlyArray<WorkflowTriggerTypeRegistryEntry> {
    return Object.freeze(this.entries.filter((entry) => entry.kind === kind));
  }

  public get(type: string): WorkflowTriggerTypeRegistryEntry | undefined {
    const resolved = getWorkflowDraftTriggerDefinition(type);
    if (!resolved || !this.byType.has(resolved.type)) {
      return undefined;
    }
    return toRegistryEntry(resolved);
  }

  public isSupported(type: string): boolean {
    return this.get(type) !== undefined;
  }

  public createDefaultConfig(type: WorkflowDraftTriggerType): Readonly<WorkflowDraftTriggerConfig> {
    const definition = this.byType.get(type);
    if (!definition) {
      throw new Error(`Workflow trigger type '${type}' is not registered.`);
    }
    return Object.freeze({ ...definition.defaultConfig }) as Readonly<WorkflowDraftTriggerConfig>;
  }

  public validateConfig(
    type: WorkflowDraftTriggerType,
    config: unknown,
  ): Readonly<WorkflowDraftTriggerConfig> {
    if (!this.byType.has(type)) {
      throw new Error(`Workflow trigger type '${type}' is not registered.`);
    }
    const definition = this.byType.get(type)!;
    const validation = validateWorkflowTriggerTypeConfig({
      id: "__trigger-config-validation__",
      kind: definition.kind,
      type,
      config: assertRecord(config, `Workflow trigger type '${type}' config`),
    });
    if (!validation.valid) {
      throw new Error(validation.issues[0]?.message ?? `Workflow trigger type '${type}' config is invalid.`);
    }
    return Object.freeze({ ...(validation.normalizedTriggers[0]?.config ?? {}) }) as Readonly<WorkflowDraftTriggerConfig>;
  }
}

export function createDefaultWorkflowTriggerTypeRegistry(): WorkflowTriggerTypeRegistry {
  return new WorkflowTriggerTypeRegistry();
}

