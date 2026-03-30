import {
  getWorkflowDraftBuiltInStepDefinition,
  listWorkflowDraftBuiltInStepDefinitions,
  normalizeWorkflowDraftBuiltInStepConfig,
  type WorkflowDraftBuiltInStepCategory,
  type WorkflowDraftBuiltInStepConfig,
  type WorkflowDraftBuiltInStepDefinition,
  type WorkflowDraftBuiltInStepType,
} from "../../domain/workflow-studio/WorkflowStudioDomain";

export interface BuiltInWorkflowStepRegistryEntry {
  readonly type: WorkflowDraftBuiltInStepType;
  readonly category: WorkflowDraftBuiltInStepCategory;
  readonly label: string;
  readonly description: string;
  readonly configSchemaId: string;
  readonly validationEntryPoint: "normalizeWorkflowDraftBuiltInStepConfig";
}

function assertRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function toRegistryEntry(definition: WorkflowDraftBuiltInStepDefinition): BuiltInWorkflowStepRegistryEntry {
  return Object.freeze({
    type: definition.type,
    category: definition.category,
    label: definition.label,
    description: definition.description,
    configSchemaId: definition.configSchemaId,
    validationEntryPoint: "normalizeWorkflowDraftBuiltInStepConfig",
  });
}

export class BuiltInWorkflowStepRegistry {
  private readonly byType = new Map<WorkflowDraftBuiltInStepType, WorkflowDraftBuiltInStepDefinition>();
  private readonly entries: ReadonlyArray<BuiltInWorkflowStepRegistryEntry>;

  public constructor(definitions: ReadonlyArray<WorkflowDraftBuiltInStepDefinition> = listWorkflowDraftBuiltInStepDefinitions()) {
    for (const definition of definitions) {
      if (this.byType.has(definition.type)) {
        throw new Error(`Built-in workflow step '${definition.type}' is already registered.`);
      }
      this.byType.set(definition.type, definition);
    }
    this.entries = Object.freeze(
      definitions.map((definition) => toRegistryEntry(definition)),
    );
  }

  public list(): ReadonlyArray<BuiltInWorkflowStepRegistryEntry> {
    return this.entries;
  }

  public listByCategory(category: WorkflowDraftBuiltInStepCategory): ReadonlyArray<BuiltInWorkflowStepRegistryEntry> {
    return Object.freeze(this.entries.filter((entry) => entry.category === category));
  }

  public get(type: string): BuiltInWorkflowStepRegistryEntry | undefined {
    const resolved = getWorkflowDraftBuiltInStepDefinition(type);
    if (!resolved || !this.byType.has(resolved.type)) {
      return undefined;
    }
    return toRegistryEntry(resolved);
  }

  public isSupported(type: string): boolean {
    return this.get(type) !== undefined;
  }

  public createDefaultConfig(type: WorkflowDraftBuiltInStepType): Readonly<WorkflowDraftBuiltInStepConfig> {
    const definition = this.byType.get(type);
    if (!definition) {
      throw new Error(`Built-in workflow step '${type}' is not registered.`);
    }
    return Object.freeze({ ...definition.defaultConfig }) as Readonly<WorkflowDraftBuiltInStepConfig>;
  }

  public validateConfig(
    type: WorkflowDraftBuiltInStepType,
    config: unknown,
  ): Readonly<WorkflowDraftBuiltInStepConfig> {
    if (!this.byType.has(type)) {
      throw new Error(`Built-in workflow step '${type}' is not registered.`);
    }
    return normalizeWorkflowDraftBuiltInStepConfig(
      type,
      assertRecord(config, `Built-in workflow step '${type}' config`),
    );
  }
}

export function createDefaultBuiltInWorkflowStepRegistry(): BuiltInWorkflowStepRegistry {
  return new BuiltInWorkflowStepRegistry();
}
