import { z } from "zod";
import type { AssetDraftDependencyReference } from "../studio-shell/StudioShellDomain";
import type { DatasetInstance } from "../system-runtime/DatasetInstanceDomain";
import type { DatasetInstanceImageRecord } from "../system-runtime/DatasetInstanceRecordDomain";
import type {
  SystemAsset,
  SystemBinding,
  SystemComponentReference,
  SystemCompositionReference,
  SystemExecutionMetadata,
  SystemInputDefinition,
  SystemOutputDefinition,
  SystemParameterDefinition,
} from "./SystemAssetDomain";

export const SystemSerializationSchemaVersion = "1.0.0";
const SupportedSchemaVersions = new Set([SystemSerializationSchemaVersion]);

export const SerializedSystemAssetReferenceKinds = Object.freeze({
  dataset: "dataset",
  workflow: "workflow",
  component: "component",
  dependency: "dependency",
  system: "system",
});

export type SerializedSystemAssetReferenceKind =
  typeof SerializedSystemAssetReferenceKinds[keyof typeof SerializedSystemAssetReferenceKinds];

export interface SerializedSystemAssetReference {
  readonly kind: SerializedSystemAssetReferenceKind;
  readonly assetId: string;
  readonly versionId?: string;
  readonly alias?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SerializedSystemRuntimeDatasetInstanceReference {
  readonly instanceId: string;
  readonly datasetAssetId?: string;
  readonly datasetVersionId?: string;
  readonly role?: string;
  readonly persistedState?: SerializedSystemRuntimeDatasetInstancePersistedState;
}

export interface SerializedSystemRuntimeDatasetInstancePersistedState {
  readonly instance?: DatasetInstance;
  readonly imageRecords?: ReadonlyArray<DatasetInstanceImageRecord>;
}

export interface SerializedSystemWorkflowBindingReference {
  readonly bindingId: string;
  readonly componentAlias?: string;
  readonly workflowAssetId: string;
  readonly workflowVersionId?: string;
  readonly pinMode: "version";
}

export interface SystemSerializationContract {
  readonly contractKind: "ai-loom.system-serialization";
  readonly schemaVersion: string;
  readonly compatibility: {
    readonly minimumReaderVersion: "1.0.0";
    readonly legacySystemSpecSupported: true;
  };
  readonly definition: {
    readonly components: ReadonlyArray<SystemComponentReference>;
    readonly nestedSystems: ReadonlyArray<SystemCompositionReference>;
    readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
    readonly inputs: ReadonlyArray<SystemInputDefinition>;
    readonly outputs: ReadonlyArray<SystemOutputDefinition>;
    readonly parameters: ReadonlyArray<SystemParameterDefinition>;
    readonly bindings: ReadonlyArray<SystemBinding>;
    readonly executionMetadata?: SystemExecutionMetadata;
  };
  readonly assetReferences: {
    readonly datasets: ReadonlyArray<SerializedSystemAssetReference>;
    readonly workflows: ReadonlyArray<SerializedSystemAssetReference>;
  };
  readonly runtime: {
    readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
    readonly workflowBindings: ReadonlyArray<SerializedSystemWorkflowBindingReference>;
    readonly bindings?: SystemExecutionMetadata["runtimeCapabilityBindings"];
    readonly state?: Readonly<Record<string, unknown>>;
  };
  readonly ui: {
    readonly configuration?: Readonly<Record<string, unknown>>;
  };
}

export interface SystemSerializationDocument {
  readonly schemaVersion: string;
  readonly contract?: SystemSerializationContract;
  readonly systemSpec: {
    readonly components: ReadonlyArray<SystemAsset["components"][number]>;
    readonly nestedSystems: ReadonlyArray<SystemAsset["nestedSystems"][number]>;
    readonly inputs: ReadonlyArray<SystemAsset["inputs"][number]>;
    readonly outputs: ReadonlyArray<SystemAsset["outputs"][number]>;
    readonly parameters: ReadonlyArray<SystemAsset["parameters"][number]>;
    readonly bindings: ReadonlyArray<SystemAsset["bindings"][number]>;
    readonly executionMetadata?: SystemAsset["executionMetadata"];
  };
  readonly uiConfiguration?: Readonly<Record<string, unknown>>;
}

const optionalStringSchema = z.string().trim().min(1).optional();
const passthroughRecordSchema = z.record(z.unknown());
const runtimeCapabilityBindingsSchema = z.object({
  schemaVersion: optionalStringSchema,
  bindings: z.array(passthroughRecordSchema).optional(),
}).strict().optional();

const systemComponentReferenceSchema = z.object({
  componentKind: z.enum(["atomic", "composite", "system"]),
  assetId: z.string().trim().min(1),
  versionId: optionalStringSchema,
  alias: optionalStringSchema,
  taxonomy: z.object({
    structuralKind: z.string().trim().min(1),
    semanticRole: z.string().trim().min(1),
    behaviorKind: z.string().trim().min(1),
  }).optional(),
}).strict();

const systemCompositionReferenceSchema = z.object({
  assetId: z.string().trim().min(1),
  versionId: optionalStringSchema,
  alias: optionalStringSchema,
}).strict();

const dependencyReferenceSchema = z.object({
  assetId: z.string().trim().min(1),
  versionId: optionalStringSchema,
}).strict();

const systemInputSchema = z.object({
  inputId: z.string().trim().min(1),
  description: optionalStringSchema,
  valueType: optionalStringSchema,
  required: z.boolean().optional(),
}).strict();

const systemOutputSchema = z.object({
  outputId: z.string().trim().min(1),
  description: optionalStringSchema,
  valueType: optionalStringSchema,
}).strict();

const systemParameterSchema = z.object({
  parameterId: z.string().trim().min(1),
  description: optionalStringSchema,
  valueType: optionalStringSchema,
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
}).strict();

const systemBindingEndpointSchema = z.object({
  scope: z.enum(["system-input", "system-output", "system-parameter", "component-input", "component-output", "component-parameter"]),
  endpointId: z.string().trim().min(1),
  componentAlias: optionalStringSchema,
}).strict();

const systemBindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  source: systemBindingEndpointSchema,
  target: systemBindingEndpointSchema,
  description: optionalStringSchema,
}).strict();

const systemExecutionMetadataSchema = z.object({
  runtime: z.object({
    environment: optionalStringSchema,
    requirements: z.array(z.string().trim().min(1)).optional(),
  }).strict().optional(),
  orchestration: z.object({
    mode: optionalStringSchema,
    hints: z.array(z.string().trim().min(1)).optional(),
  }).strict().optional(),
  publish: z.object({
    visibility: z.enum(["private", "team", "public"]).optional(),
    exportTargets: z.array(z.string().trim().min(1)).optional(),
  }).strict().optional(),
  executionProfile: z.object({
    profileId: optionalStringSchema,
    latencyTier: z.enum(["standard", "low-latency", "batch"]).optional(),
  }).strict().optional(),
  operations: z.object({
    ownerTeam: optionalStringSchema,
    supportContact: optionalStringSchema,
    notes: optionalStringSchema,
  }).strict().optional(),
  runtimeCapabilityBindings: z.object({
    schemaVersion: optionalStringSchema,
    bindings: z.array(passthroughRecordSchema).optional(),
  }).strict().optional(),
  workflowContextMapping: passthroughRecordSchema.optional(),
}).strict().optional();

const assetReferenceSchema = z.object({
  kind: z.enum(["dataset", "workflow", "component", "dependency", "system"]),
  assetId: z.string().trim().min(1),
  versionId: optionalStringSchema,
  alias: optionalStringSchema,
  metadata: passthroughRecordSchema.optional(),
}).strict();

const datasetInstancePersistedStateSchema = z.object({
  instance: passthroughRecordSchema.optional(),
  imageRecords: z.array(passthroughRecordSchema).optional(),
}).strict();

const datasetInstanceReferenceSchema = z.object({
  instanceId: z.string().trim().min(1),
  datasetAssetId: optionalStringSchema,
  datasetVersionId: optionalStringSchema,
  role: optionalStringSchema,
  persistedState: datasetInstancePersistedStateSchema.optional(),
}).strict();

const workflowBindingReferenceSchema = z.object({
  bindingId: z.string().trim().min(1),
  componentAlias: optionalStringSchema,
  workflowAssetId: z.string().trim().min(1),
  workflowVersionId: optionalStringSchema,
  pinMode: z.literal("version"),
}).strict();

const serializationContractSchema = z.object({
  contractKind: z.literal("ai-loom.system-serialization"),
  schemaVersion: z.string().trim().min(1),
  compatibility: z.object({
    minimumReaderVersion: z.literal("1.0.0"),
    legacySystemSpecSupported: z.literal(true),
  }).strict(),
  definition: z.object({
    components: z.array(systemComponentReferenceSchema).default([]),
    nestedSystems: z.array(systemCompositionReferenceSchema).default([]),
    dependencies: z.array(dependencyReferenceSchema).default([]),
    inputs: z.array(systemInputSchema).default([]),
    outputs: z.array(systemOutputSchema).default([]),
    parameters: z.array(systemParameterSchema).default([]),
    bindings: z.array(systemBindingSchema).default([]),
    executionMetadata: systemExecutionMetadataSchema,
  }).strict(),
  assetReferences: z.object({
    datasets: z.array(assetReferenceSchema).default([]),
    workflows: z.array(assetReferenceSchema).default([]),
  }).strict(),
  runtime: z.object({
    datasetInstances: z.array(datasetInstanceReferenceSchema).default([]),
    workflowBindings: z.array(workflowBindingReferenceSchema).default([]),
    bindings: runtimeCapabilityBindingsSchema,
    state: passthroughRecordSchema.optional(),
  }).strict(),
  ui: z.object({
    configuration: passthroughRecordSchema.optional(),
  }).strict(),
}).strict();

function parseRootEnvelope(content: string): Record<string, unknown> {
  if (!content.trim()) {
    return {};
  }
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("System draft content must be a JSON object.");
  }
  return { ...(parsed as Record<string, unknown>) };
}

function collectLegacyReferences(input: {
  readonly components: ReadonlyArray<SystemComponentReference>;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly executionMetadata?: SystemExecutionMetadata;
  readonly systemSpec: Record<string, unknown>;
}): {
  readonly datasets: ReadonlyArray<SerializedSystemAssetReference>;
  readonly workflows: ReadonlyArray<SerializedSystemAssetReference>;
  readonly datasetInstances: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
  readonly workflowBindings: ReadonlyArray<SerializedSystemWorkflowBindingReference>;
} {
  const datasetMap = new Map<string, SerializedSystemAssetReference>();
  const workflowMap = new Map<string, SerializedSystemAssetReference>();
  const datasetInstanceMap = new Map<string, SerializedSystemRuntimeDatasetInstanceReference>();
  const workflowBindingMap = new Map<string, SerializedSystemWorkflowBindingReference>();

  for (const component of input.components) {
    if (component.assetId.includes("workflow")) {
      const reference: SerializedSystemAssetReference = Object.freeze({
        kind: SerializedSystemAssetReferenceKinds.workflow,
        assetId: component.assetId,
        versionId: component.versionId,
        alias: component.alias,
      });
      workflowMap.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
      const bindingId = `component:${component.alias ?? component.assetId}`;
      workflowBindingMap.set(bindingId, Object.freeze({
        bindingId,
        componentAlias: component.alias,
        workflowAssetId: component.assetId,
        workflowVersionId: component.versionId,
        pinMode: "version",
      }));
    }
  }

  for (const dependency of input.dependencies) {
    if (dependency.assetId.includes("dataset")) {
      const reference: SerializedSystemAssetReference = Object.freeze({
        kind: SerializedSystemAssetReferenceKinds.dataset,
        assetId: dependency.assetId,
        versionId: dependency.versionId,
      });
      datasetMap.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
    }
    if (dependency.assetId.includes("workflow")) {
      const reference: SerializedSystemAssetReference = Object.freeze({
        kind: SerializedSystemAssetReferenceKinds.workflow,
        assetId: dependency.assetId,
        versionId: dependency.versionId,
      });
      workflowMap.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
    }
  }

  const runtimeBindingEntries = input.executionMetadata?.runtimeCapabilityBindings?.bindings;
  for (const entry of runtimeBindingEntries ?? []) {
    const profile = (entry as { readonly bindingContract?: { readonly workflowExecutionProfile?: { readonly workflowAssetId?: unknown } } }).bindingContract?.workflowExecutionProfile;
    if (profile && typeof profile.workflowAssetId === "string" && profile.workflowAssetId.trim()) {
      const reference: SerializedSystemAssetReference = Object.freeze({
        kind: SerializedSystemAssetReferenceKinds.workflow,
        assetId: profile.workflowAssetId.trim(),
      });
      workflowMap.set(`${reference.assetId}::`, reference);
    }
  }

  const runtimeContext = input.systemSpec.referenceImageRuntimeContext;
  if (runtimeContext && typeof runtimeContext === "object" && !Array.isArray(runtimeContext)) {
    const datasets = (runtimeContext as { readonly runtimeContext?: { readonly datasets?: ReadonlyArray<{ readonly instanceId?: unknown; readonly role?: unknown; readonly assetRef?: { readonly assetId?: unknown; readonly versionId?: unknown } }> } }).runtimeContext?.datasets;
    for (const entry of datasets ?? []) {
      const instanceId = typeof entry.instanceId === "string" ? entry.instanceId.trim() : "";
      if (!instanceId) {
        continue;
      }
      const datasetAssetId = typeof entry.assetRef?.assetId === "string" ? entry.assetRef.assetId.trim() : undefined;
      const datasetVersionId = typeof entry.assetRef?.versionId === "string" ? entry.assetRef.versionId.trim() : undefined;
      const role = typeof entry.role === "string" ? entry.role.trim() : undefined;
      datasetInstanceMap.set(instanceId, Object.freeze({
        instanceId,
        datasetAssetId,
        datasetVersionId,
        role,
      }));
      if (datasetAssetId) {
        const reference: SerializedSystemAssetReference = Object.freeze({
          kind: SerializedSystemAssetReferenceKinds.dataset,
          assetId: datasetAssetId,
          versionId: datasetVersionId,
        });
        datasetMap.set(`${reference.assetId}::${reference.versionId ?? ""}`, reference);
      }
    }
  }

  return Object.freeze({
    datasets: Object.freeze([...datasetMap.values()]),
    workflows: Object.freeze([...workflowMap.values()]),
    datasetInstances: Object.freeze([...datasetInstanceMap.values()]),
    workflowBindings: Object.freeze([...workflowBindingMap.values()]),
  });
}

function normalizeParsedContract(contract: z.infer<typeof serializationContractSchema>): SystemSerializationContract {
  return Object.freeze({
    contractKind: contract.contractKind,
    schemaVersion: contract.schemaVersion,
    compatibility: Object.freeze({
      minimumReaderVersion: contract.compatibility.minimumReaderVersion,
      legacySystemSpecSupported: contract.compatibility.legacySystemSpecSupported,
    }),
    definition: Object.freeze({
      components: Object.freeze(contract.definition.components),
      nestedSystems: Object.freeze(contract.definition.nestedSystems),
      dependencies: Object.freeze(contract.definition.dependencies),
      inputs: Object.freeze(contract.definition.inputs),
      outputs: Object.freeze(contract.definition.outputs),
      parameters: Object.freeze(contract.definition.parameters),
      bindings: Object.freeze(contract.definition.bindings),
      executionMetadata: contract.definition.executionMetadata,
    }),
    assetReferences: Object.freeze({
      datasets: Object.freeze(contract.assetReferences.datasets),
      workflows: Object.freeze(contract.assetReferences.workflows),
    }),
    runtime: Object.freeze({
      datasetInstances: Object.freeze(contract.runtime.datasetInstances),
      workflowBindings: Object.freeze(contract.runtime.workflowBindings),
      bindings: contract.runtime.bindings,
      state: contract.runtime.state,
    }),
    ui: Object.freeze({
      configuration: contract.ui.configuration,
    }),
  });
}

function createLegacyBackfilledContract(input: {
  readonly systemSpec: Record<string, unknown>;
  readonly components: ReadonlyArray<SystemComponentReference>;
  readonly nestedSystems: ReadonlyArray<SystemCompositionReference>;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly inputs: ReadonlyArray<SystemInputDefinition>;
  readonly outputs: ReadonlyArray<SystemOutputDefinition>;
  readonly parameters: ReadonlyArray<SystemParameterDefinition>;
  readonly bindings: ReadonlyArray<SystemBinding>;
  readonly executionMetadata?: SystemExecutionMetadata;
}): SystemSerializationContract {
  const extracted = collectLegacyReferences({
    components: input.components,
    dependencies: input.dependencies,
    executionMetadata: input.executionMetadata,
    systemSpec: input.systemSpec,
  });
  const uiConfiguration = Object.entries(input.systemSpec)
    .filter(([key]) => !["components", "nestedSystems", "inputs", "outputs", "parameters", "bindings", "executionMetadata", "serialization"].includes(key))
    .reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return Object.freeze({
    contractKind: "ai-loom.system-serialization",
    schemaVersion: SystemSerializationSchemaVersion,
    compatibility: Object.freeze({
      minimumReaderVersion: "1.0.0",
      legacySystemSpecSupported: true,
    }),
    definition: Object.freeze({
      components: Object.freeze([...input.components]),
      nestedSystems: Object.freeze([...input.nestedSystems]),
      dependencies: Object.freeze([...input.dependencies]),
      inputs: Object.freeze([...input.inputs]),
      outputs: Object.freeze([...input.outputs]),
      parameters: Object.freeze([...input.parameters]),
      bindings: Object.freeze([...input.bindings]),
      executionMetadata: input.executionMetadata,
    }),
    assetReferences: Object.freeze({
      datasets: extracted.datasets,
      workflows: extracted.workflows,
    }),
    runtime: Object.freeze({
      datasetInstances: extracted.datasetInstances,
      workflowBindings: extracted.workflowBindings,
      bindings: input.executionMetadata?.runtimeCapabilityBindings,
      state: undefined,
    }),
    ui: Object.freeze({
      configuration: Object.keys(uiConfiguration).length > 0 ? Object.freeze(uiConfiguration) : undefined,
    }),
  });
}

export function parseSystemSerializationDocument(input: {
  readonly content: string;
  readonly dependencies?: ReadonlyArray<AssetDraftDependencyReference>;
}): SystemSerializationDocument {
  const root = parseRootEnvelope(input.content);
  const rawSystemSpec = root.systemSpec;
  const systemSpec = (rawSystemSpec && typeof rawSystemSpec === "object" && !Array.isArray(rawSystemSpec))
    ? { ...(rawSystemSpec as Record<string, unknown>) }
    : {};

  const components = z.array(systemComponentReferenceSchema).default([]).parse(systemSpec.components);
  const nestedSystems = z.array(systemCompositionReferenceSchema).default([]).parse(systemSpec.nestedSystems);
  const inputs = z.array(systemInputSchema).default([]).parse(systemSpec.inputs);
  const outputs = z.array(systemOutputSchema).default([]).parse(systemSpec.outputs);
  const parameters = z.array(systemParameterSchema).default([]).parse(systemSpec.parameters);
  const bindings = z.array(systemBindingSchema).default([]).parse(systemSpec.bindings);
  const executionMetadata = systemExecutionMetadataSchema.parse(systemSpec.executionMetadata);
  const dependencies = z.array(dependencyReferenceSchema).default([]).parse(input.dependencies ?? []);

  const serializedContractRaw = systemSpec.serialization;
  let contract: SystemSerializationContract;
  if (serializedContractRaw && typeof serializedContractRaw === "object" && !Array.isArray(serializedContractRaw)) {
    const parsedContract = serializationContractSchema.parse(serializedContractRaw);
    if (!SupportedSchemaVersions.has(parsedContract.schemaVersion)) {
      throw new Error(`unsupported-system-serialization-version:${parsedContract.schemaVersion}`);
    }
    contract = normalizeParsedContract(parsedContract);
  } else {
    contract = createLegacyBackfilledContract({
      systemSpec,
      components,
      nestedSystems,
      dependencies,
      inputs,
      outputs,
      parameters,
      bindings,
      executionMetadata,
    });
  }

  return Object.freeze({
    schemaVersion: contract.schemaVersion,
    contract,
    systemSpec: Object.freeze({
      components: Object.freeze(contract.definition.components),
      nestedSystems: Object.freeze(contract.definition.nestedSystems),
      inputs: Object.freeze(contract.definition.inputs),
      outputs: Object.freeze(contract.definition.outputs),
      parameters: Object.freeze(contract.definition.parameters),
      bindings: Object.freeze(contract.definition.bindings),
      executionMetadata: contract.definition.executionMetadata,
    }),
    uiConfiguration: contract.ui.configuration,
  });
}

export function serializeSystemSerializationDocument(input: {
  readonly existingContent: string;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly systemSpec: SystemSerializationDocument["systemSpec"];
  readonly uiConfiguration?: Readonly<Record<string, unknown>>;
  readonly runtimeDatasetInstances?: ReadonlyArray<SerializedSystemRuntimeDatasetInstanceReference>;
  readonly runtimeWorkflowBindings?: ReadonlyArray<SerializedSystemWorkflowBindingReference>;
  readonly runtimeState?: Readonly<Record<string, unknown>>;
}): string {
  const root = parseRootEnvelope(input.existingContent);
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};

  const contract = createLegacyBackfilledContract({
    systemSpec: {
      ...existingSystemSpec,
      ...(input.uiConfiguration ?? {}),
    },
    components: input.systemSpec.components,
    nestedSystems: input.systemSpec.nestedSystems,
    dependencies: input.dependencies,
    inputs: input.systemSpec.inputs,
    outputs: input.systemSpec.outputs,
    parameters: input.systemSpec.parameters,
    bindings: input.systemSpec.bindings,
    executionMetadata: input.systemSpec.executionMetadata,
  });

  const normalizedContract: SystemSerializationContract = (input.runtimeDatasetInstances || input.runtimeWorkflowBindings || input.runtimeState)
    ? Object.freeze({
      ...contract,
      runtime: Object.freeze({
        ...contract.runtime,
        datasetInstances: Object.freeze([...(input.runtimeDatasetInstances ?? contract.runtime.datasetInstances)]),
        workflowBindings: Object.freeze([...(input.runtimeWorkflowBindings ?? contract.runtime.workflowBindings)]),
        state: input.runtimeState ?? contract.runtime.state,
      }),
    })
    : contract;

  const mergedSystemSpec: Record<string, unknown> = {
    ...existingSystemSpec,
    ...input.systemSpec,
    serialization: normalizedContract,
  };

  if (input.uiConfiguration) {
    for (const [key, value] of Object.entries(input.uiConfiguration)) {
      mergedSystemSpec[key] = value;
    }
  }

  root.systemSpec = mergedSystemSpec;
  return JSON.stringify(root, null, 2);
}
