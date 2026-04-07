import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  PipelineTemplateCategories,
  validatePipelineTemplateDefinition,
  validatePipelineTemplateInstantiationOptions,
  type PipelineTemplateDefinition,
  type PipelineTemplateId,
  type PipelineTemplateInstantiationOptions,
} from "../../domain/dataset-studio/MidLevelPipelineTemplateDomain";
import {
  createPipelineStageInstance,
  type PipelineStageId,
  type PipelineStageInstance,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  createDocumentPreparationPipelineDefinition,
  createImagePreparationPipelineDefinition,
  createTabularCleaningPipelineDefinition,
  type MidLevelPipelineDefinition,
} from "./MidLevelPipelineDefinitions";
import { buildReactFlowGraph, type PipelineReactFlowGraph } from "./PipelineReactFlowGraph";
import { PipelineValidationService } from "./PipelineValidationService";

type TemplateRuntimeFactory = () => MidLevelPipelineDefinition;

interface TemplateRuntimeEntry {
  readonly definition: PipelineTemplateDefinition;
  readonly factory: TemplateRuntimeFactory;
}

export interface PipelineTemplateInstantiationResult {
  readonly template: PipelineTemplateDefinition;
  readonly pipelineDefinition: MidLevelPipelineDefinition["definition"];
  readonly pipelineGraph: ReturnType<MidLevelPipelineDefinition["buildGraph"]>;
  readonly reactFlowGraph: PipelineReactFlowGraph;
  readonly wizardInitialization: {
    readonly guidedStageIds: ReadonlyArray<PipelineStageId>;
    readonly autoConfiguredStageIds: ReadonlyArray<PipelineStageId>;
    readonly progressiveDisclosureStageIds: ReadonlyArray<PipelineStageId>;
    readonly skippedByDefaultStageIds: ReadonlyArray<PipelineStageId>;
    readonly stageRationaleById: Readonly<Partial<Record<PipelineStageId, string>>>;
  };
}

function toStageConfigMap(
  pipeline: MidLevelPipelineDefinition,
): Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>> {
  return Object.freeze(
    Object.fromEntries(
      pipeline.definition.stageInstances.map((stageInstance) => [
        stageInstance.stageId,
        Object.freeze({ ...stageInstance.config.options }),
      ]),
    ) as Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>,
  );
}

function mergeStageConfigs(
  baseline: Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>,
  overrides: Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>>,
): Readonly<Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>> {
  return Object.freeze(
    Object.fromEntries(
      Object.keys({ ...baseline, ...overrides }).map((stageId) => {
        const resolvedStageId = stageId as PipelineStageId;
        return [
          resolvedStageId,
          Object.freeze({
            ...(baseline[resolvedStageId] ?? {}),
            ...(overrides[resolvedStageId] ?? {}),
          }),
        ];
      }),
    ) as Partial<Record<PipelineStageId, Readonly<Record<string, CanonicalRecordValue>>>>,
  );
}

function assertStageOrderCoverage(
  template: PipelineTemplateDefinition,
  stageOrder: ReadonlyArray<PipelineStageId>,
): void {
  const stageSet = new Set(stageOrder);
  for (const requiredStageId of template.defaultStageIds) {
    if (!stageSet.has(requiredStageId)) {
      throw new Error(`Template '${template.id}' stageOrder is missing required stage '${requiredStageId}'.`);
    }
  }
  for (const stageId of stageOrder) {
    if (!template.defaultStageIds.includes(stageId) && !template.optionalStageIds.includes(stageId)) {
      throw new Error(`Template '${template.id}' stageOrder contains unknown stage '${stageId}'.`);
    }
  }
}

function createStageInstance(
  stageRegistry: PipelineStageRegistry,
  input: {
    readonly stageId: PipelineStageId;
    readonly enabled: boolean;
    readonly config: Readonly<Record<string, CanonicalRecordValue>>;
  },
): PipelineStageInstance {
  const stageDefinition = stageRegistry.getDefinition(input.stageId);
  return createPipelineStageInstance({
    definition: stageDefinition,
    enabled: input.enabled,
    config: {
      mode: "advanced",
      options: input.config,
    },
  });
}

function buildTemplateRegistryEntries(): ReadonlyArray<TemplateRuntimeEntry> {
  const commonEditing = Object.freeze({
    canReorderStages: true,
    canInsertOptionalStages: true,
    canRemoveOptionalStages: true,
    canToggleOptionalStages: true,
    canEditStageConfiguration: true,
  });
  const commonPreview = Object.freeze({
    supportsPipelinePreview: true,
    supportsStagePreview: true,
    supportedPreviewKinds: Object.freeze([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
      CanonicalDataShapeKinds.textItems,
      CanonicalDataShapeKinds.imageMetadataRecords,
    ]),
  });

  const generalFactory = () => createTabularCleaningPipelineDefinition({
    includeTransformation: true,
    includeFeatureEngineering: false,
    includeAggregation: false,
  });
  const analyticsFactory = () => createTabularCleaningPipelineDefinition({
    includeTransformation: true,
    includeFeatureEngineering: true,
    includeAggregation: true,
  });
  const documentFactory = () => createDocumentPreparationPipelineDefinition({
    includeLabeling: false,
    includeEnrichment: false,
    chunkingStrategy: "character",
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const imageFactory = () => createImagePreparationPipelineDefinition({
    includeExtraction: false,
    includeTransformation: true,
    includeLabeling: false,
    includeEnrichment: false,
  });

  const general = generalFactory();
  const analytics = analyticsFactory();
  const document = documentFactory();
  const image = imageFactory();

  return Object.freeze([
    Object.freeze({
      definition: validatePipelineTemplateDefinition({
        id: "general-data-preparation",
        category: PipelineTemplateCategories.generalDataPreparation,
        displayName: "General Data Preparation",
        description: "General-purpose tabular data preparation flow with normalized cleaning defaults.",
        intendedUseCase: "Initialize a reusable baseline flow for common dataset cleanup and transformation tasks.",
        defaultStageIds: Object.freeze([
          "Normalization",
          "Cleaning",
          "Transformation",
        ]),
        optionalStageIds: Object.freeze([
          "FeatureEngineering",
          "Aggregation",
        ]),
        defaultStageConfigs: toStageConfigMap(general),
        supportedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records, CanonicalDataShapeKinds.table]),
        supportedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records, CanonicalDataShapeKinds.table]),
        editingCapabilities: commonEditing,
        previewSupport: commonPreview,
        wizardMetadata: Object.freeze({
          guidedStageIds: Object.freeze([
            "Normalization",
            "Cleaning",
            "Transformation",
            "FeatureEngineering",
            "Aggregation",
          ]),
          autoConfiguredStageIds: Object.freeze(["Normalization", "Cleaning"]),
          progressiveDisclosureStageIds: Object.freeze(["FeatureEngineering", "Aggregation"]),
          stageRationaleById: Object.freeze({
            Normalization: "Normalize source field types first so downstream quality checks are deterministic.",
            Cleaning: "Apply canonical missing value and deduplication policy before transformation.",
            Transformation: "Prepare columns and validation rules for shared downstream consumers.",
            FeatureEngineering: "Optional feature derivation for model-oriented outputs.",
            Aggregation: "Optional grouped summaries for reporting and metrics use cases.",
          }),
        }),
      }),
      factory: generalFactory,
    }),
    Object.freeze({
      definition: validatePipelineTemplateDefinition({
        id: "analytics-preparation",
        category: PipelineTemplateCategories.analyticsPreparation,
        displayName: "Analytics Preparation",
        description: "Analytics-focused stage composition with enrichment/feature and aggregation emphasis.",
        intendedUseCase: "Initialize analytics pipelines needing normalized cleaning, feature derivation, and aggregate outputs.",
        defaultStageIds: Object.freeze([
          "Normalization",
          "Cleaning",
          "Transformation",
          "FeatureEngineering",
          "Aggregation",
        ]),
        optionalStageIds: Object.freeze([]),
        defaultStageConfigs: toStageConfigMap(analytics),
        supportedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records, CanonicalDataShapeKinds.table]),
        supportedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records, CanonicalDataShapeKinds.table]),
        editingCapabilities: commonEditing,
        previewSupport: commonPreview,
        wizardMetadata: Object.freeze({
          guidedStageIds: Object.freeze([
            "Normalization",
            "Cleaning",
            "Transformation",
            "FeatureEngineering",
            "Aggregation",
          ]),
          autoConfiguredStageIds: Object.freeze(["Normalization", "Cleaning", "FeatureEngineering"]),
          progressiveDisclosureStageIds: Object.freeze(["FeatureEngineering", "Aggregation"]),
          stageRationaleById: Object.freeze({
            Normalization: "Normalize raw records for consistent metrics and model compatibility.",
            Cleaning: "Resolve missing values and deduplication before analytics projections.",
            Transformation: "Apply schema and rule alignment before feature and aggregate processing.",
            FeatureEngineering: "Generate reusable analytical features for KPI and model-ready views.",
            Aggregation: "Produce summary-level analytics outputs for reporting surfaces.",
          }),
        }),
      }),
      factory: analyticsFactory,
    }),
    Object.freeze({
      definition: validatePipelineTemplateDefinition({
        id: "document-preparation",
        category: PipelineTemplateCategories.documentPreparation,
        displayName: "Document Preparation",
        description: "Document-first extraction and chunking flow with optional labeling and enrichment hooks.",
        intendedUseCase: "Initialize document preparation for extraction, normalization, chunking, and optional annotation.",
        defaultStageIds: Object.freeze([
          "Extraction",
          "Normalization",
          "Chunking",
        ]),
        optionalStageIds: Object.freeze([
          "Labeling",
          "Enrichment",
        ]),
        defaultStageConfigs: toStageConfigMap(document),
        supportedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.textItems, CanonicalDataShapeKinds.records]),
        supportedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.textItems, CanonicalDataShapeKinds.records]),
        editingCapabilities: commonEditing,
        previewSupport: commonPreview,
        wizardMetadata: Object.freeze({
          guidedStageIds: Object.freeze([
            "Extraction",
            "Normalization",
            "Chunking",
            "Labeling",
            "Enrichment",
          ]),
          autoConfiguredStageIds: Object.freeze(["Extraction", "Chunking"]),
          progressiveDisclosureStageIds: Object.freeze(["Labeling", "Enrichment"]),
          stageRationaleById: Object.freeze({
            Extraction: "Extract text and metadata from source documents before normalization.",
            Normalization: "Normalize extracted content and canonical metadata contracts.",
            Chunking: "Create chunk-level outputs for downstream retrieval and model contexts.",
            Labeling: "Optional annotation stage for supervised learning and quality review.",
            Enrichment: "Optional metadata augmentation and lookup-based enrichment stage.",
          }),
        }),
      }),
      factory: documentFactory,
    }),
    Object.freeze({
      definition: validatePipelineTemplateDefinition({
        id: "image-preparation",
        category: PipelineTemplateCategories.imagePreparation,
        displayName: "Image Preparation",
        description: "Image-focused normalization and transformation with optional OCR extraction and enrichment hooks.",
        intendedUseCase: "Initialize image preparation workflows with optional OCR extraction, annotation, and enrichment.",
        defaultStageIds: Object.freeze([
          "Normalization",
          "Transformation",
        ]),
        optionalStageIds: Object.freeze([
          "Extraction",
          "Labeling",
          "Enrichment",
        ]),
        defaultStageConfigs: toStageConfigMap(image),
        supportedInputShapeKinds: Object.freeze([
          CanonicalDataShapeKinds.imageMetadataRecords,
          CanonicalDataShapeKinds.textItems,
        ]),
        supportedOutputShapeKinds: Object.freeze([
          CanonicalDataShapeKinds.imageMetadataRecords,
          CanonicalDataShapeKinds.textItems,
          CanonicalDataShapeKinds.records,
        ]),
        editingCapabilities: commonEditing,
        previewSupport: commonPreview,
        wizardMetadata: Object.freeze({
          guidedStageIds: Object.freeze([
            "Extraction",
            "Normalization",
            "Transformation",
            "Labeling",
            "Enrichment",
          ]),
          autoConfiguredStageIds: Object.freeze(["Normalization", "Transformation"]),
          progressiveDisclosureStageIds: Object.freeze(["Extraction", "Labeling", "Enrichment"]),
          stageRationaleById: Object.freeze({
            Extraction: "Optional OCR extraction to emit text payloads from image inputs.",
            Normalization: "Normalize image metadata and canonical fields before additional stages.",
            Transformation: "Apply deterministic image and metadata transformations.",
            Labeling: "Optional annotation layer for image classification and supervised workflows.",
            Enrichment: "Optional enrichment stage for metadata augmentation and external joins.",
          }),
        }),
      }),
      factory: imageFactory,
    }),
  ]);
}

export class MidLevelPipelineTemplateService {
  private readonly stageRegistry: PipelineStageRegistry;
  private readonly entriesById: ReadonlyMap<PipelineTemplateId, TemplateRuntimeEntry>;
  private readonly validationService: PipelineValidationService;

  constructor(input?: {
    readonly stageRegistry?: PipelineStageRegistry;
    readonly entries?: ReadonlyArray<TemplateRuntimeEntry>;
  }) {
    this.stageRegistry = input?.stageRegistry ?? new PipelineStageRegistry();
    const entries = input?.entries ?? buildTemplateRegistryEntries();
    if (entries.length === 0) {
      throw new Error("MidLevelPipelineTemplateService requires at least one template.");
    }
    this.entriesById = new Map(entries.map((entry) => [entry.definition.id, entry]));
    this.validationService = new PipelineValidationService();
  }

  public listTemplates(): ReadonlyArray<PipelineTemplateDefinition> {
    return Object.freeze([...this.entriesById.values()].map((entry) => entry.definition));
  }

  public getTemplate(templateId: PipelineTemplateId): PipelineTemplateDefinition {
    const normalized = templateId.trim();
    const entry = this.entriesById.get(normalized);
    if (!entry) {
      throw new Error(`Mid-level pipeline template '${normalized}' is not registered.`);
    }
    return entry.definition;
  }

  public instantiate(
    templateId: PipelineTemplateId,
    optionsInput?: PipelineTemplateInstantiationOptions,
  ): PipelineTemplateInstantiationResult {
    const normalizedTemplateId = templateId.trim();
    const entry = this.entriesById.get(normalizedTemplateId);
    if (!entry) {
      throw new Error(`Mid-level pipeline template '${normalizedTemplateId}' is not registered.`);
    }
    const template = entry.definition;
    const options = validatePipelineTemplateInstantiationOptions(optionsInput ?? {});
    const pipeline = entry.factory();
    const templateDefaultConfig = template.defaultStageConfigs;
    const mergedConfig = mergeStageConfigs(templateDefaultConfig, options.stageConfigOverrides ?? {});

    const enabledOptional = new Set(options.enabledOptionalStageIds ?? []);
    const disabledOptional = new Set(options.disabledOptionalStageIds ?? []);
    const requiredStageIds = new Set(template.defaultStageIds);
    const optionalStageIds = new Set(template.optionalStageIds);

    const defaultOrder = Object.freeze(
      template.wizardMetadata.guidedStageIds.filter(
        (stageId) => template.defaultStageIds.includes(stageId) || template.optionalStageIds.includes(stageId),
      ),
    );
    const resolvedStageOrder = options.stageOrder && options.stageOrder.length > 0
      ? Object.freeze([...options.stageOrder])
      : defaultOrder;
    assertStageOrderCoverage(template, resolvedStageOrder);

    const stageInstances = Object.freeze(
      resolvedStageOrder.map((stageId) => {
        const enabled = requiredStageIds.has(stageId)
          ? true
          : optionalStageIds.has(stageId)
            ? (enabledOptional.has(stageId) && !disabledOptional.has(stageId))
            : true;

        const mergedStageConfig = Object.freeze({
          ...(mergedConfig[stageId] ?? {}),
        });
        return createStageInstance(this.stageRegistry, {
          stageId,
          enabled,
          config: mergedStageConfig,
        });
      }),
    );

    const definition = Object.freeze({
      ...pipeline.definition,
      stageInstances,
    });

    const validated = this.validationService.validate({
      definition,
      stageCompositions: pipeline.stageCompositions,
      context: "template-instantiation",
    });
    const reactFlowGraph = buildReactFlowGraph(validated.graph);

    const skippedByDefaultStageIds = Object.freeze(
      stageInstances
        .filter((stage) => !stage.enabled)
        .map((stage) => stage.stageId),
    );

    return Object.freeze({
      template,
      pipelineDefinition: validated.definition,
      pipelineGraph: validated.graph,
      reactFlowGraph,
      wizardInitialization: Object.freeze({
        guidedStageIds: template.wizardMetadata.guidedStageIds,
        autoConfiguredStageIds: template.wizardMetadata.autoConfiguredStageIds,
        progressiveDisclosureStageIds: template.wizardMetadata.progressiveDisclosureStageIds,
        skippedByDefaultStageIds,
        stageRationaleById: template.wizardMetadata.stageRationaleById,
      }),
    });
  }
}

export function createMidLevelPipelineTemplateService(input?: {
  readonly stageRegistry?: PipelineStageRegistry;
  readonly entries?: ReadonlyArray<TemplateRuntimeEntry>;
}): MidLevelPipelineTemplateService {
  return new MidLevelPipelineTemplateService(input);
}
