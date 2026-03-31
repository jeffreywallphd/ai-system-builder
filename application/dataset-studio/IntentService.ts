import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createIntentDefinition,
  type IntentDefinition,
} from "../../domain/dataset-studio/IntentDomain";
import {
  DatasetIngestionStageAssetIds,
  DatasetPipelineStageExecutionModes,
  DatasetPipelineStageKinds,
  type DatasetPipelineStageDefinition,
  type DatasetPipelineStageKind,
} from "../../domain/dataset-studio/StagePipelineDomain";
import {
  createStageFlowDefinition,
  insertStageInFlow,
  removeStageFromFlow,
  reorderFlowStages,
  type StageFlowDefinition,
} from "../../domain/dataset-studio/StageFlowDefinition";
import {
  CanonicalDataShapeKinds,
  type CanonicalDataShapeKind,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineTemplate } from "../../domain/dataset-studio/PipelineTemplateDomain";
import { StageAssetMappingService } from "./StageAssetMappingService";
import {
  TemplateService,
  type PipelineTemplateInstantiationRequest,
} from "./TemplateService";

export interface IntentContext {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly templateId: string;
}

export interface IntentResolutionRequest {
  readonly intentId?: string;
  readonly intentPreset?: IntentDefinition;
  readonly templateId?: string;
  readonly stageConfigurationOverrides?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly skippedStageIds?: ReadonlyArray<string>;
  readonly orderedStageIds?: ReadonlyArray<string>;
}

export interface IntentResolution {
  readonly intent: IntentContext;
  readonly template: PipelineTemplate;
  readonly stageFlow: StageFlowDefinition;
  readonly templateStageConfigurationDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly intentStageConfigurationDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly defaultStageConfiguration: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

const AllShapeKinds = Object.freeze([
  CanonicalDataShapeKinds.records,
  CanonicalDataShapeKinds.table,
  CanonicalDataShapeKinds.textItems,
  CanonicalDataShapeKinds.imageMetadataRecords,
] as ReadonlyArray<CanonicalDataShapeKind>);

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function freezeConfigMap(
  value: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
): Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>> {
  return Object.freeze(
    Object.entries(value).reduce<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>((accumulator, [stageId, config]) => {
      accumulator[normalizeRequired(stageId, "stageConfiguration.stageId")] = Object.freeze({ ...config });
      return accumulator;
    }, {}),
  );
}

function createStageBlueprint(input: {
  readonly id: string;
  readonly kind: DatasetPipelineStageKind;
  readonly name: string;
  readonly description: string;
}): DatasetPipelineStageDefinition {
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    order: 1,
    name: input.name,
    description: input.description,
    dataContract: Object.freeze({
      acceptedInputShapeKinds: AllShapeKinds,
      producedOutputShapeKinds: AllShapeKinds,
    }),
    assetReferences: Object.freeze([
      Object.freeze({ assetId: DatasetIngestionStageAssetIds.unified }),
    ]),
    executionPolicy: Object.freeze({
      mode: DatasetPipelineStageExecutionModes.required,
    }),
  });
}

function createDefaultIntents(): ReadonlyArray<IntentDefinition> {
  return Object.freeze([
    createIntentDefinition({
      id: "analytics",
      name: "Analytics",
      description: "Profiles, cleans, and aggregates structured sources for analytics delivery.",
      associatedTemplateIds: Object.freeze(["analytics-default", "elt-default"]),
      stageOverrides: Object.freeze({
        includeStageKinds: Object.freeze([
          DatasetPipelineStageKinds.profiling,
          DatasetPipelineStageKinds.aggregation,
        ]),
        defaultStageConfiguration: Object.freeze({
          profiling: Object.freeze({ sampleSize: 1000 }),
          aggregation: Object.freeze({ grain: "daily" }),
        }),
      }),
    }),
    createIntentDefinition({
      id: "document",
      name: "Document Processing",
      description: "Extracts and chunks document-centric payloads before downstream preparation.",
      associatedTemplateIds: Object.freeze(["document-default", "elt-default"]),
      stageOverrides: Object.freeze({
        includeStageKinds: Object.freeze([
          DatasetPipelineStageKinds.extraction,
          DatasetPipelineStageKinds.chunking,
        ]),
        defaultStageConfiguration: Object.freeze({
          extraction: Object.freeze({ includeLayoutMetadata: true }),
          chunking: Object.freeze({ chunkSize: 500, chunkOverlap: 50 }),
        }),
      }),
    }),
    createIntentDefinition({
      id: "ml",
      name: "Machine Learning",
      description: "Adds feature engineering and normalization defaults for model-ready datasets.",
      associatedTemplateIds: Object.freeze(["elt-default", "analytics-default"]),
      stageOverrides: Object.freeze({
        includeStageKinds: Object.freeze([
          DatasetPipelineStageKinds.featureEngineering,
          DatasetPipelineStageKinds.normalization,
        ]),
        stageOrderPreferences: Object.freeze([
          Object.freeze({
            stageKind: DatasetPipelineStageKinds.featureEngineering,
            afterStageId: "cleaning",
          }),
        ]),
        defaultStageConfiguration: Object.freeze({
          normalization: Object.freeze({ schemaMode: "known", useDetectedSchema: true }),
          "feature-engineering": Object.freeze({ strategy: "model-features" }),
        }),
      }),
      stageBlueprints: Object.freeze([
        createStageBlueprint({
          id: "feature-engineering",
          kind: DatasetPipelineStageKinds.featureEngineering,
          name: "Feature Engineering",
          description: "Derives model-ready features from normalized records.",
        }),
      ]),
    }),
  ]);
}

function withOrder(
  stage: DatasetPipelineStageDefinition,
  order: number,
): DatasetPipelineStageDefinition {
  return Object.freeze({
    ...stage,
    order,
  });
}

function toStageCatalog(
  templates: ReadonlyArray<PipelineTemplate>,
  intents: ReadonlyArray<IntentDefinition>,
): Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>> {
  const catalog: Partial<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>> = {};
  for (const template of templates) {
    for (const stage of template.stageFlow.stages) {
      if (!catalog[stage.kind]) {
        catalog[stage.kind] = withOrder(stage, 1);
      }
    }
  }
  for (const intent of intents) {
    for (const stage of intent.stageBlueprints ?? []) {
      if (!catalog[stage.kind]) {
        catalog[stage.kind] = withOrder(stage, 1);
      }
    }
  }
  return Object.freeze(catalog as Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>>);
}

function mergeDefaults(
  templateDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
  intentDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
  overrideDefaults: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>,
): Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>> {
  return freezeConfigMap({
    ...templateDefaults,
    ...intentDefaults,
    ...overrideDefaults,
  });
}

export class IntentService {
  private readonly intents: ReadonlyArray<IntentDefinition>;
  private readonly templateService: TemplateService;
  private readonly mappingService: StageAssetMappingService;
  private readonly stageCatalog: Readonly<Record<DatasetPipelineStageKind, DatasetPipelineStageDefinition>>;

  constructor(
    templateService: TemplateService = new TemplateService(),
    mappingService: StageAssetMappingService = new StageAssetMappingService(),
    intents: ReadonlyArray<IntentDefinition> = createDefaultIntents(),
  ) {
    if (intents.length === 0) {
      throw new Error("IntentService requires at least one intent definition.");
    }
    this.templateService = templateService;
    this.mappingService = mappingService;
    this.intents = Object.freeze(intents.map((intent) => createIntentDefinition(intent)));
    const templates = this.templateService.listTemplates().map((descriptor) => this.templateService.getTemplate(descriptor.id));
    this.stageCatalog = toStageCatalog(templates, this.intents);
  }

  public listIntents(): ReadonlyArray<IntentDefinition> {
    return this.intents;
  }

  public getIntent(intentId: string): IntentDefinition {
    const normalizedIntentId = normalizeRequired(intentId, "intentId");
    const intent = this.intents.find((entry) => entry.id === normalizedIntentId);
    if (!intent) {
      throw new Error(`Intent '${normalizedIntentId}' is not registered.`);
    }
    return intent;
  }

  public resolve(request: IntentResolutionRequest): IntentResolution {
    const preset = request.intentPreset ? createIntentDefinition(request.intentPreset) : undefined;
    const intent = preset ?? this.getIntent(normalizeRequired(request.intentId ?? "", "IntentResolutionRequest.intentId"));
    const templateId = request.templateId ?? intent.associatedTemplateIds[0];
    if (!templateId) {
      throw new Error(`Intent '${intent.id}' does not define an associated template id.`);
    }

    const instantiation: PipelineTemplateInstantiationRequest = Object.freeze({
      templateId,
      orderedStageIds: request.orderedStageIds,
      skippedStageIds: request.skippedStageIds,
      stageConfigurationOverrides: request.stageConfigurationOverrides,
    });
    const instance = this.templateService.instantiate(instantiation);

    let stageFlow = createStageFlowDefinition({
      flowId: instance.stageFlow.flowId,
      name: instance.stageFlow.name,
      description: instance.stageFlow.description,
      stages: instance.stageFlow.stages,
      conditionalTransitions: instance.stageFlow.conditionalTransitions,
    });

    const includedKinds = new Set(intent.stageOverrides?.includeStageKinds ?? []);
    const excludedKinds = new Set(intent.stageOverrides?.excludeStageKinds ?? []);

    for (const stage of [...stageFlow.stages]) {
      if (excludedKinds.has(stage.kind)) {
        stageFlow = removeStageFromFlow(stageFlow, stage.id);
      }
    }

    for (const stageKind of includedKinds) {
      if (stageFlow.stages.some((stage) => stage.kind === stageKind)) {
        continue;
      }
      const stage = this.stageCatalog[stageKind];
      if (!stage) {
        throw new Error(`Intent '${intent.id}' requires stage kind '${stageKind}' but no blueprint is registered.`);
      }
      const preference = intent.stageOverrides?.stageOrderPreferences
        ?.find((entry) => entry.stageKind === stageKind);
      const beforeIndex = preference?.beforeStageId
        ? stageFlow.stages.findIndex((entry) => entry.id === preference.beforeStageId)
        : -1;
      const afterIndex = preference?.afterStageId
        ? stageFlow.stages.findIndex((entry) => entry.id === preference.afterStageId)
        : -1;
      const preparedStorageIndex = stageFlow.stages.findIndex((entry) => entry.kind === DatasetPipelineStageKinds.preparedStorage);
      const insertionOrder = beforeIndex >= 0
        ? beforeIndex + 1
        : afterIndex >= 0
          ? afterIndex + 2
          : preparedStorageIndex >= 0
            ? preparedStorageIndex + 1
            : stageFlow.stages.length + 1;
      stageFlow = insertStageInFlow(stageFlow, stage, insertionOrder);
    }

    if (intent.stageOverrides?.orderedStageIds && intent.stageOverrides.orderedStageIds.length > 0) {
      const presentIds = new Set(stageFlow.stages.map((stage) => stage.id));
      const ordered = intent.stageOverrides.orderedStageIds
        .filter((stageId) => presentIds.has(stageId));
      const remaining = stageFlow.stages
        .map((stage) => stage.id)
        .filter((stageId) => !ordered.includes(stageId));
      const merged = Object.freeze([...ordered, ...remaining]);
      stageFlow = reorderFlowStages(stageFlow, merged);
    }

    this.validateResolvedFlow(stageFlow, templateId);

    const mergedDefaults = mergeDefaults(
      instance.template.defaultStageConfiguration ?? Object.freeze({}),
      intent.stageOverrides?.defaultStageConfiguration ?? Object.freeze({}),
      request.stageConfigurationOverrides ?? Object.freeze({}),
    );

    return Object.freeze({
      intent: Object.freeze({
        id: intent.id,
        name: intent.name,
        description: intent.description,
        templateId,
      }),
      template: Object.freeze({
        ...instance.template,
        stageFlow,
        defaultStageConfiguration: mergedDefaults,
      }),
      stageFlow,
      templateStageConfigurationDefaults: freezeConfigMap(instance.template.defaultStageConfiguration ?? Object.freeze({})),
      intentStageConfigurationDefaults: freezeConfigMap(intent.stageOverrides?.defaultStageConfiguration ?? Object.freeze({})),
      defaultStageConfiguration: mergedDefaults,
    });
  }

  private validateResolvedFlow(stageFlow: StageFlowDefinition, templateId: string): void {
    for (const stage of stageFlow.stages) {
      const mapping = this.mappingService.resolveStage({ stageKind: stage.kind });
      if (mapping.status === "unsupported") {
        throw new Error(
          `Intent-adjusted flow for template '${templateId}' includes unmapped stage kind '${stage.kind}' (${mapping.failureCode}).`,
        );
      }
    }
    createStageFlowDefinition({
      flowId: stageFlow.flowId,
      name: stageFlow.name,
      description: stageFlow.description,
      stages: stageFlow.stages,
      conditionalTransitions: stageFlow.conditionalTransitions,
    });
  }
}

export function createIntentService(
  templateService?: TemplateService,
  mappingService?: StageAssetMappingService,
  intents?: ReadonlyArray<IntentDefinition>,
): IntentService {
  return new IntentService(templateService, mappingService, intents);
}
