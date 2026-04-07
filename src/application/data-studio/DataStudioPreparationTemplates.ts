import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  PipelineStageConfigModes,
  PipelineStageIds,
  type PipelineStageConfigMode,
  type PipelineStageId,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  UnifiedPreparationStageActivationModes,
  type UnifiedPreparationAssetDefinition,
  type UnifiedPreparationStageActivation,
  type UnifiedPreparationStageConfig,
  type UnifiedPreparationVisibilityMode,
} from "../../domain/dataset-studio/UnifiedPreparationAsset";
import { UnifiedPreparationPipelineService } from "../dataset-studio/UnifiedPreparationPipelineService";
import { createDefaultDataStudioPreparationAssetDefinition } from "./DataStudioPreparationAssetDefaults";

export const DataStudioPreparationTemplateIntents = Object.freeze({
  elt: "elt",
  analytics: "analytics",
  documentProcessing: "document-processing",
  imageProcessing: "image-processing",
} as const);

export type DataStudioPreparationTemplateIntent =
  typeof DataStudioPreparationTemplateIntents[keyof typeof DataStudioPreparationTemplateIntents];

export interface DataStudioPreparationTemplateConditionContext {
  readonly currentStageId: PipelineStageId;
  readonly presentationMode: "simple" | "advanced";
  readonly completedStageIds: ReadonlyArray<PipelineStageId>;
  readonly skippedStageIds: ReadonlyArray<PipelineStageId>;
  readonly stageOptions: Readonly<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>;
}

export type DataStudioPreparationTemplateConditionEvaluator = (
  context: DataStudioPreparationTemplateConditionContext,
) => boolean;

export interface DataStudioPreparationFieldDependency {
  readonly stageId: PipelineStageId;
  readonly optionKey: string;
  readonly equals?: CanonicalRecordValue;
  readonly in?: ReadonlyArray<CanonicalRecordValue>;
}

export type DataStudioPreparationFieldInputKind = "text" | "number" | "toggle" | "select";

export interface DataStudioPreparationFieldOption {
  readonly label: string;
  readonly value: CanonicalRecordValue;
}

export interface DataStudioPreparationFieldDescriptor {
  readonly fieldId: string;
  readonly stageId: PipelineStageId;
  readonly optionKey: string;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly inputKind: DataStudioPreparationFieldInputKind;
  readonly visibility: UnifiedPreparationVisibilityMode;
  readonly defaultValue?: CanonicalRecordValue;
  readonly options?: ReadonlyArray<DataStudioPreparationFieldOption>;
  readonly templates?: ReadonlyArray<string>;
  readonly dependsOn?: DataStudioPreparationFieldDependency;
}

export interface DataStudioPreparationFieldVisibilityOverride {
  readonly stageId: PipelineStageId;
  readonly fieldId: string;
  readonly visibility?: UnifiedPreparationVisibilityMode;
  readonly templates?: ReadonlyArray<string>;
  readonly dependsOn?: DataStudioPreparationFieldDependency;
}

export interface DataStudioPreparationTemplateStageDefault {
  readonly stageId: PipelineStageId;
  readonly visibility?: UnifiedPreparationVisibilityMode;
  readonly configMode?: PipelineStageConfigMode;
  readonly activation?: UnifiedPreparationStageActivation;
  readonly options?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataStudioPreparationTemplateAssetBinding {
  readonly stageId: PipelineStageId;
  readonly assetGroupIds: ReadonlyArray<string>;
}

export interface DataStudioPreparationTemplateDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly intent: DataStudioPreparationTemplateIntent;
  readonly upstreamPipelineAssetId: string;
  readonly stageDefaults: ReadonlyArray<DataStudioPreparationTemplateStageDefault>;
  readonly assetBindings: ReadonlyArray<DataStudioPreparationTemplateAssetBinding>;
  readonly fieldVisibilityOverrides?: ReadonlyArray<DataStudioPreparationFieldVisibilityOverride>;
  readonly conditionEvaluators?: Readonly<Record<string, DataStudioPreparationTemplateConditionEvaluator>>;
}

export interface DataStudioPreparationTemplateSummary {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly intent: DataStudioPreparationTemplateIntent;
}

export interface DataStudioPreparationTemplateInstantiation {
  readonly template: DataStudioPreparationTemplateDefinition;
  readonly asset: UnifiedPreparationAssetDefinition;
}

const RequiredTemplateStages = Object.freeze([
  PipelineStageIds.SourceSelection,
  PipelineStageIds.UnifiedIngestion,
  PipelineStageIds.StoragePrepared,
] as const);

function freezeOptions(
  value: Readonly<Record<string, CanonicalRecordValue>> | undefined,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...(value ?? {}) });
}

function freezeStageActivation(
  value: UnifiedPreparationStageActivation | undefined,
): UnifiedPreparationStageActivation {
  if (!value) {
    return Object.freeze({ mode: UnifiedPreparationStageActivationModes.always });
  }
  return Object.freeze({
    mode: value.mode,
    conditionId: value.conditionId,
    reason: value.reason,
  });
}

function stageDefault(input: {
  readonly stageId: PipelineStageId;
  readonly visibility?: UnifiedPreparationVisibilityMode;
  readonly configMode?: PipelineStageConfigMode;
  readonly activation?: UnifiedPreparationStageActivation;
  readonly options?: Readonly<Record<string, CanonicalRecordValue>>;
}): DataStudioPreparationTemplateStageDefault {
  return Object.freeze({
    stageId: input.stageId,
    visibility: input.visibility,
    configMode: input.configMode,
    activation: input.activation ? freezeStageActivation(input.activation) : undefined,
    options: freezeOptions(input.options),
  });
}

const DefaultFieldDescriptors: ReadonlyArray<DataStudioPreparationFieldDescriptor> = Object.freeze([
  Object.freeze({
    fieldId: "source-kind",
    stageId: PipelineStageIds.SourceSelection,
    optionKey: "sourceKind",
    label: "Source kind",
    inputKind: "select",
    visibility: "simple",
    defaultValue: "auto",
    options: Object.freeze([
      Object.freeze({ label: "auto", value: "auto" }),
      Object.freeze({ label: "csv", value: "csv" }),
      Object.freeze({ label: "json", value: "json" }),
      Object.freeze({ label: "document", value: "document" }),
      Object.freeze({ label: "image", value: "image" }),
    ]),
  }),
  Object.freeze({
    fieldId: "source-reference",
    stageId: PipelineStageIds.SourceSelection,
    optionKey: "sourceReference",
    label: "Source reference",
    inputKind: "text",
    visibility: "simple",
    placeholder: "in-memory://source or C:\\data\\source.csv",
  }),
  Object.freeze({
    fieldId: "enable-feature-engineering",
    stageId: PipelineStageIds.SourceSelection,
    optionKey: "enableFeatureEngineering",
    label: "Enable feature engineering",
    description: "Controls optional feature stage activation in analytics-oriented templates.",
    inputKind: "toggle",
    visibility: "advanced",
    templates: Object.freeze(["analytics-pipeline"]),
    defaultValue: true,
  }),
  Object.freeze({
    fieldId: "enable-labeling",
    stageId: PipelineStageIds.SourceSelection,
    optionKey: "enableLabeling",
    label: "Enable labeling",
    description: "Controls optional labeling stage activation for document pipelines.",
    inputKind: "toggle",
    visibility: "advanced",
    templates: Object.freeze(["document-pipeline"]),
    defaultValue: false,
  }),
  Object.freeze({
    fieldId: "ingestion-strategy",
    stageId: PipelineStageIds.UnifiedIngestion,
    optionKey: "strategy",
    label: "Ingestion strategy",
    inputKind: "select",
    visibility: "advanced",
    defaultValue: "auto",
    options: Object.freeze([
      Object.freeze({ label: "auto", value: "auto" }),
      Object.freeze({ label: "csv", value: "csv" }),
      Object.freeze({ label: "json", value: "json" }),
      Object.freeze({ label: "document", value: "document" }),
      Object.freeze({ label: "image", value: "image" }),
    ]),
  }),
  Object.freeze({
    fieldId: "ingestion-output-target",
    stageId: PipelineStageIds.UnifiedIngestion,
    optionKey: "outputTarget",
    label: "Output target",
    inputKind: "select",
    visibility: "simple",
    defaultValue: "records",
    options: Object.freeze([
      Object.freeze({ label: "records", value: "records" }),
      Object.freeze({ label: "text-items", value: "text-items" }),
      Object.freeze({ label: "image-metadata-records", value: "image-metadata-records" }),
    ]),
  }),
  Object.freeze({
    fieldId: "chunk-size",
    stageId: PipelineStageIds.Chunking,
    optionKey: "chunkSize",
    label: "Chunk size",
    inputKind: "number",
    visibility: "simple",
    defaultValue: 500,
    templates: Object.freeze(["document-pipeline"]),
  }),
  Object.freeze({
    fieldId: "chunk-overlap",
    stageId: PipelineStageIds.Chunking,
    optionKey: "chunkOverlap",
    label: "Chunk overlap",
    inputKind: "number",
    visibility: "advanced",
    defaultValue: 50,
    templates: Object.freeze(["document-pipeline"]),
  }),
  Object.freeze({
    fieldId: "aggregation-group-by",
    stageId: PipelineStageIds.Aggregation,
    optionKey: "groupByFields",
    label: "Group by fields (CSV)",
    inputKind: "text",
    visibility: "simple",
    defaultValue: "",
    templates: Object.freeze(["analytics-pipeline"]),
  }),
  Object.freeze({
    fieldId: "feature-strategy",
    stageId: PipelineStageIds.FeatureEngineering,
    optionKey: "featureStrategy",
    label: "Feature strategy",
    inputKind: "select",
    visibility: "advanced",
    defaultValue: "structured",
    templates: Object.freeze(["analytics-pipeline"]),
    options: Object.freeze([
      Object.freeze({ label: "structured", value: "structured" }),
      Object.freeze({ label: "text", value: "text" }),
      Object.freeze({ label: "hybrid", value: "hybrid" }),
    ]),
  }),
  Object.freeze({
    fieldId: "prepared-destination",
    stageId: PipelineStageIds.StoragePrepared,
    optionKey: "destination",
    label: "Prepared destination",
    inputKind: "text",
    visibility: "simple",
    placeholder: "prepared://dataset",
    defaultValue: "prepared://dataset",
  }),
]);

const DefaultTemplates: ReadonlyArray<DataStudioPreparationTemplateDefinition> = Object.freeze([
  Object.freeze({
    id: "elt-pipeline",
    version: "1.0.0",
    name: "ELT Pipeline",
    description: "Ingestion to raw/prepared storage with transform-oriented defaults for common ELT workflows.",
    intent: DataStudioPreparationTemplateIntents.elt,
    upstreamPipelineAssetId: "pipeline.tabular-cleaning.v1",
    stageDefaults: Object.freeze([
      stageDefault({ stageId: PipelineStageIds.SourceSelection, options: Object.freeze({ sourceKind: "auto" }) }),
      stageDefault({ stageId: PipelineStageIds.UnifiedIngestion, options: Object.freeze({ strategy: "auto", outputTarget: "records" }) }),
      stageDefault({ stageId: PipelineStageIds.StorageRaw, visibility: "simple", activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.Transformation, visibility: "simple", activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.StoragePrepared, options: Object.freeze({ destination: "prepared://elt" }) }),
    ]),
    assetBindings: Object.freeze([
      Object.freeze({ stageId: PipelineStageIds.SourceSelection, assetGroupIds: Object.freeze(["source-selection"]) }),
      Object.freeze({ stageId: PipelineStageIds.UnifiedIngestion, assetGroupIds: Object.freeze(["ingestion-routing"]) }),
      Object.freeze({ stageId: PipelineStageIds.StorageRaw, assetGroupIds: Object.freeze(["raw-storage"]) }),
      Object.freeze({ stageId: PipelineStageIds.Transformation, assetGroupIds: Object.freeze(["transformation"]) }),
      Object.freeze({ stageId: PipelineStageIds.StoragePrepared, assetGroupIds: Object.freeze(["prepared-storage"]) }),
    ]),
  }),
  Object.freeze({
    id: "analytics-pipeline",
    version: "1.0.0",
    name: "Analytics Pipeline",
    description: "Ingestion with cleaning, aggregation, and optional feature engineering defaults for analytics tasks.",
    intent: DataStudioPreparationTemplateIntents.analytics,
    upstreamPipelineAssetId: "pipeline.tabular-cleaning.v1",
    stageDefaults: Object.freeze([
      stageDefault({
        stageId: PipelineStageIds.SourceSelection,
        options: Object.freeze({ sourceKind: "auto", enableFeatureEngineering: true }),
      }),
      stageDefault({ stageId: PipelineStageIds.UnifiedIngestion, options: Object.freeze({ strategy: "auto", outputTarget: "records" }) }),
      stageDefault({ stageId: PipelineStageIds.Cleaning, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.Aggregation, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({
        stageId: PipelineStageIds.FeatureEngineering,
        visibility: "advanced",
        activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.conditional, conditionId: "analytics-feature-engineering-enabled" }),
      }),
      stageDefault({ stageId: PipelineStageIds.StoragePrepared, options: Object.freeze({ destination: "prepared://analytics" }) }),
    ]),
    assetBindings: Object.freeze([
      Object.freeze({ stageId: PipelineStageIds.Cleaning, assetGroupIds: Object.freeze(["cleaning"]) }),
      Object.freeze({ stageId: PipelineStageIds.Aggregation, assetGroupIds: Object.freeze(["aggregation"]) }),
      Object.freeze({ stageId: PipelineStageIds.FeatureEngineering, assetGroupIds: Object.freeze(["feature-generation", "feature-projection"]) }),
    ]),
    conditionEvaluators: Object.freeze({
      "analytics-feature-engineering-enabled": (context) => context.stageOptions.SourceSelection?.enableFeatureEngineering !== false,
    }),
  }),
  Object.freeze({
    id: "document-pipeline",
    version: "1.0.0",
    name: "Document Pipeline",
    description: "Document-first flow with extraction, chunking, and optional labeling defaults.",
    intent: DataStudioPreparationTemplateIntents.documentProcessing,
    upstreamPipelineAssetId: "pipeline.document-preparation.v1",
    stageDefaults: Object.freeze([
      stageDefault({
        stageId: PipelineStageIds.SourceSelection,
        options: Object.freeze({ sourceKind: "document", enableLabeling: false }),
      }),
      stageDefault({ stageId: PipelineStageIds.UnifiedIngestion, options: Object.freeze({ strategy: "document", outputTarget: "text-items" }) }),
      stageDefault({ stageId: PipelineStageIds.Extraction, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.Chunking, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }), options: Object.freeze({ chunkSize: 500, chunkOverlap: 50 }) }),
      stageDefault({
        stageId: PipelineStageIds.Labeling,
        visibility: "advanced",
        activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.conditional, conditionId: "document-labeling-enabled" }),
      }),
      stageDefault({ stageId: PipelineStageIds.StoragePrepared, options: Object.freeze({ destination: "prepared://documents" }) }),
    ]),
    assetBindings: Object.freeze([
      Object.freeze({ stageId: PipelineStageIds.Extraction, assetGroupIds: Object.freeze(["extraction"]) }),
      Object.freeze({ stageId: PipelineStageIds.Chunking, assetGroupIds: Object.freeze(["chunking"]) }),
      Object.freeze({ stageId: PipelineStageIds.Labeling, assetGroupIds: Object.freeze(["annotation-target-preparation", "annotation-label-attachment"]) }),
    ]),
    conditionEvaluators: Object.freeze({
      "document-labeling-enabled": (context) => context.stageOptions.SourceSelection?.enableLabeling === true,
    }),
  }),
  Object.freeze({
    id: "image-pipeline",
    version: "1.0.0",
    name: "Image Pipeline",
    description: "Image preparation flow with metadata profiling and transformation defaults.",
    intent: DataStudioPreparationTemplateIntents.imageProcessing,
    upstreamPipelineAssetId: "pipeline.image-preparation.v1",
    stageDefaults: Object.freeze([
      stageDefault({ stageId: PipelineStageIds.SourceSelection, options: Object.freeze({ sourceKind: "image" }) }),
      stageDefault({ stageId: PipelineStageIds.UnifiedIngestion, options: Object.freeze({ strategy: "image", outputTarget: "image-metadata-records" }) }),
      stageDefault({ stageId: PipelineStageIds.Profiling, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.Transformation, activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.always }) }),
      stageDefault({ stageId: PipelineStageIds.StoragePrepared, options: Object.freeze({ destination: "prepared://images" }) }),
    ]),
    assetBindings: Object.freeze([
      Object.freeze({ stageId: PipelineStageIds.Profiling, assetGroupIds: Object.freeze(["profiling"]) }),
      Object.freeze({ stageId: PipelineStageIds.Transformation, assetGroupIds: Object.freeze(["transformation"]) }),
    ]),
  }),
]);

export class DataStudioPreparationTemplateRegistry {
  private readonly templatesById: ReadonlyMap<string, DataStudioPreparationTemplateDefinition>;
  private readonly defaultTemplateId: string;
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly pipelineService: UnifiedPreparationPipelineService;
  private readonly fieldDescriptors: ReadonlyArray<DataStudioPreparationFieldDescriptor>;

  constructor(input?: {
    readonly templates?: ReadonlyArray<DataStudioPreparationTemplateDefinition>;
    readonly defaultTemplateId?: string;
    readonly stageRegistry?: PipelineStageRegistry;
    readonly pipelineService?: UnifiedPreparationPipelineService;
    readonly fieldDescriptors?: ReadonlyArray<DataStudioPreparationFieldDescriptor>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    this.pipelineService = input?.pipelineService ?? new UnifiedPreparationPipelineService({
      stageRegistry: this.stageRegistry,
    });
    const templates = input?.templates ?? DefaultTemplates;
    if (templates.length === 0) {
      throw new Error("Data Studio template registry requires at least one template.");
    }

    const normalized = templates.map((template) => this.validateTemplateDefinition(template));
    const templateEntries: Array<[string, DataStudioPreparationTemplateDefinition]> = [];
    const seenTemplateIds = new Set<string>();
    for (const template of normalized) {
      if (seenTemplateIds.has(template.id)) {
        throw new Error(`Data Studio template registry includes duplicate template id '${template.id}'.`);
      }
      seenTemplateIds.add(template.id);
      templateEntries.push([template.id, template]);
    }
    this.templatesById = new Map(templateEntries);
    this.defaultTemplateId = input?.defaultTemplateId?.trim() || normalized[0]?.id || "";
    if (!this.templatesById.has(this.defaultTemplateId)) {
      throw new Error(`Data Studio default template '${this.defaultTemplateId}' is not registered.`);
    }

    this.fieldDescriptors = Object.freeze((input?.fieldDescriptors ?? DefaultFieldDescriptors).map((field) => Object.freeze({
      ...field,
      options: field.options ? Object.freeze([...field.options]) : undefined,
      templates: field.templates ? Object.freeze([...field.templates]) : undefined,
    })));
  }

  public listTemplates(): ReadonlyArray<DataStudioPreparationTemplateSummary> {
    return Object.freeze([...this.templatesById.values()].map((template) => this.toSummary(template)));
  }

  public getDefaultTemplateId(): string {
    return this.defaultTemplateId;
  }

  public getTemplate(templateId: string): DataStudioPreparationTemplateDefinition {
    const normalizedTemplateId = templateId.trim();
    const template = this.templatesById.get(normalizedTemplateId);
    if (!template) {
      throw new Error(`Data Studio template '${normalizedTemplateId}' is not registered.`);
    }
    return template;
  }

  public getTemplateSummary(templateId: string): DataStudioPreparationTemplateSummary {
    return this.toSummary(this.getTemplate(templateId));
  }

  public listFieldDescriptors(): ReadonlyArray<DataStudioPreparationFieldDescriptor> {
    return this.fieldDescriptors;
  }

  public resolveFieldVisibilityOverride(
    templateId: string,
    stageId: PipelineStageId,
    fieldId: string,
  ): DataStudioPreparationFieldVisibilityOverride | undefined {
    const template = this.getTemplate(templateId);
    return template.fieldVisibilityOverrides?.find((entry) => entry.stageId === stageId && entry.fieldId === fieldId);
  }

  public instantiate(templateId: string): DataStudioPreparationTemplateInstantiation {
    const template = this.getTemplate(templateId);
    const base = createDefaultDataStudioPreparationAssetDefinition(this.stageRegistry);
    const defaultsByStageId = new Map(template.stageDefaults.map((stageDefault) => [stageDefault.stageId, stageDefault]));

    const stages = Object.freeze(base.stages.map((stage) => {
      const stageDefinition = this.stageRegistry.getDefinition(stage.stageId);
      const templateDefault = defaultsByStageId.get(stage.stageId);
      if (!templateDefault) {
        if (!stageDefinition.isOptional) {
          return stage;
        }
        return Object.freeze({
          ...stage,
          visibility: "advanced" as const,
          configMode: PipelineStageConfigModes.advanced,
          activation: Object.freeze({ mode: UnifiedPreparationStageActivationModes.disabled }),
        } satisfies UnifiedPreparationStageConfig);
      }
      return Object.freeze({
        ...stage,
        visibility: templateDefault.visibility ?? stage.visibility,
        configMode: templateDefault.configMode ?? stage.configMode,
        activation: templateDefault.activation ?? stage.activation,
        options: Object.freeze({
          ...stage.options,
          ...(templateDefault.options ?? {}),
        }),
      } satisfies UnifiedPreparationStageConfig);
    }));

    const preparedDestination = stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared)?.options.destination;
    const destination = typeof preparedDestination === "string" && preparedDestination.trim().length > 0
      ? preparedDestination
      : "prepared://dataset";

    const asset: UnifiedPreparationAssetDefinition = Object.freeze({
      ...base,
      identity: Object.freeze({
        ...base.identity,
        assetId: `data-studio.preparation.${template.id}`,
        versionId: template.version,
      }),
      versioning: Object.freeze({
        ...base.versioning,
        revision: 1,
      }),
      upstreamBindings: Object.freeze([
        Object.freeze({
          pipelineAssetId: template.upstreamPipelineAssetId,
        }),
      ]),
      stages,
      output: Object.freeze({
        ...base.output,
        preparedAssetId: `data-studio.prepared.${template.id}`,
      }),
      storageTarget: Object.freeze({
        targetId: destination,
      }),
      lineage: Object.freeze({
        ...base.lineage,
        upstreamAssetIds: Object.freeze([template.upstreamPipelineAssetId]),
      }),
    });

    this.pipelineService.resolve(asset);

    return Object.freeze({
      template,
      asset,
    });
  }

  private validateTemplateDefinition(
    template: DataStudioPreparationTemplateDefinition,
  ): DataStudioPreparationTemplateDefinition {
    const normalizedId = template.id.trim();
    if (!normalizedId) {
      throw new Error("Data Studio template id is required.");
    }
    if (!template.name.trim()) {
      throw new Error(`Data Studio template '${normalizedId}' requires a name.`);
    }
    if (!template.description.trim()) {
      throw new Error(`Data Studio template '${normalizedId}' requires a description.`);
    }
    if (!template.version.trim()) {
      throw new Error(`Data Studio template '${normalizedId}' requires a version.`);
    }

    const stageDefaultIds = new Set<PipelineStageId>();
    for (const stageDefault of template.stageDefaults) {
      if (!this.stageRegistry.has(stageDefault.stageId)) {
        throw new Error(`Data Studio template '${normalizedId}' references unknown stage '${stageDefault.stageId}'.`);
      }
      if (stageDefaultIds.has(stageDefault.stageId)) {
        throw new Error(`Data Studio template '${normalizedId}' includes duplicate defaults for stage '${stageDefault.stageId}'.`);
      }
      stageDefaultIds.add(stageDefault.stageId);
    }

    for (const requiredStageId of RequiredTemplateStages) {
      if (!stageDefaultIds.has(requiredStageId)) {
        throw new Error(`Data Studio template '${normalizedId}' is missing required stage '${requiredStageId}'.`);
      }
    }

    const bindingStageIds = new Set<PipelineStageId>();
    for (const binding of template.assetBindings) {
      if (!this.stageRegistry.has(binding.stageId)) {
        throw new Error(`Data Studio template '${normalizedId}' references unknown binding stage '${binding.stageId}'.`);
      }
      if (bindingStageIds.has(binding.stageId)) {
        throw new Error(`Data Studio template '${normalizedId}' includes duplicate asset binding for stage '${binding.stageId}'.`);
      }
      bindingStageIds.add(binding.stageId);
    }

    return Object.freeze({
      ...template,
      id: normalizedId,
      version: template.version.trim(),
      name: template.name.trim(),
      description: template.description.trim(),
      upstreamPipelineAssetId: template.upstreamPipelineAssetId.trim(),
      stageDefaults: Object.freeze(template.stageDefaults.map((stageEntry) => Object.freeze({
        ...stageEntry,
        options: freezeOptions(stageEntry.options),
        activation: stageEntry.activation ? freezeStageActivation(stageEntry.activation) : undefined,
      }))),
      assetBindings: Object.freeze(template.assetBindings.map((binding) => Object.freeze({
        ...binding,
        assetGroupIds: Object.freeze([...binding.assetGroupIds]),
      }))),
      fieldVisibilityOverrides: template.fieldVisibilityOverrides
        ? Object.freeze(template.fieldVisibilityOverrides.map((entry) => Object.freeze({
          ...entry,
          templates: entry.templates ? Object.freeze([...entry.templates]) : undefined,
          dependsOn: entry.dependsOn ? Object.freeze({
            ...entry.dependsOn,
            in: entry.dependsOn.in ? Object.freeze([...entry.dependsOn.in]) : undefined,
          }) : undefined,
        })))
        : undefined,
      conditionEvaluators: template.conditionEvaluators
        ? Object.freeze({ ...template.conditionEvaluators })
        : undefined,
    });
  }

  private toSummary(template: DataStudioPreparationTemplateDefinition): DataStudioPreparationTemplateSummary {
    return Object.freeze({
      id: template.id,
      version: template.version,
      name: template.name,
      description: template.description,
      intent: template.intent,
    });
  }
}

export function createDefaultDataStudioPreparationTemplateRegistry(): DataStudioPreparationTemplateRegistry {
  return new DataStudioPreparationTemplateRegistry();
}
