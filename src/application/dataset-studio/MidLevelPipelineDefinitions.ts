import { getEncoding, type TiktokenEncoding } from "js-tiktoken";
import { z } from "zod";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalTextItemsShape,
  isCanonicalDataShape,
  CanonicalDataShapeKinds,
  type CanonicalDataShape,
  type CanonicalImageMetadataRecordsShape,
  type CanonicalRecordValue,
  type CanonicalTextItemsShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  EnrichmentStrategyKinds,
  createEnrichmentStageConfig,
  parseEnrichmentStageConfigFromStageOptions,
  toEnrichmentStageOptions,
  type EnrichmentStageConfig,
} from "@domain/dataset-studio/EnrichmentStageDomain";
import {
  FeatureEngineeringStrategyKinds,
  createFeatureEngineeringStageConfig,
  toFeatureEngineeringStageOptions,
} from "@domain/dataset-studio/FeatureEngineeringStageDomain";
import {
  AnnotationModeKinds,
  AnnotationTargetKinds,
  createLabelingStageConfig,
  toLabelingStageOptions,
} from "@domain/dataset-studio/LabelingStageDomain";
import type { PipelineDefinition } from "@domain/dataset-studio/PipelineDefinitionDomain";
import { validatePipelineDefinition } from "@domain/dataset-studio/PipelineDefinitionDomain";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
  type PipelineStageId,
  type PipelineStageInstance,
} from "@domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "@domain/dataset-studio/PipelineStageRegistry";
import {
  DatasetIngestionStageAssetIds,
  DatasetTransformationStageAssetIds,
} from "@domain/dataset-studio/StagePipelineDomain";
import type {
  IImageTransformer,
  ImageTransformationResult,
} from "@domain/dataset-studio/interfaces/ImageInspection";
import type { ResolvedDataSource } from "./DataConverterContracts";
import { createDefaultMediaAdapterBundle } from "./adapters/media/MediaAdapterFactory";
import {
  DocumentPdfIngestorAsset,
  type DocumentPdfIngestorConfig,
} from "./DocumentPdfIngestorAsset";
import {
  ImageIngestorAsset,
  type ImageIngestorConfig,
} from "./ImageIngestorAsset";
import {
  buildPipelineGraph,
  type BuildPipelineGraphInput,
} from "./PipelineGraphConstructionService";
import {
  PipelineInspectionService,
  type PipelineInspectionHooks,
} from "./PipelineInspectionService";
import { buildReactFlowGraph } from "./PipelineReactFlowGraph";
import type { StageCompositionDefinition } from "./StageAssetCompositionService";
import { summarizeNumericValues } from "./core/data/transformation/TransformationStatistics";

const TabularStageIds = Object.freeze([
  PipelineStageIds.Normalization,
  PipelineStageIds.Cleaning,
  PipelineStageIds.Transformation,
  PipelineStageIds.FeatureEngineering,
  PipelineStageIds.Aggregation,
] as const);

const DocumentStageIds = Object.freeze([
  PipelineStageIds.Extraction,
  PipelineStageIds.Normalization,
  PipelineStageIds.Chunking,
  PipelineStageIds.Labeling,
  PipelineStageIds.Enrichment,
] as const);

const DefaultTabularStageOrder = Object.freeze([
  PipelineStageIds.Normalization,
  PipelineStageIds.Cleaning,
  PipelineStageIds.Transformation,
  PipelineStageIds.FeatureEngineering,
  PipelineStageIds.Aggregation,
] as const);

const DefaultDocumentStageOrder = Object.freeze([
  PipelineStageIds.Extraction,
  PipelineStageIds.Normalization,
  PipelineStageIds.Chunking,
  PipelineStageIds.Labeling,
  PipelineStageIds.Enrichment,
] as const);

const ImageStageIds = Object.freeze([
  PipelineStageIds.Extraction,
  PipelineStageIds.Normalization,
  PipelineStageIds.Transformation,
  PipelineStageIds.Labeling,
  PipelineStageIds.Enrichment,
] as const);

const DefaultImageStageOrder = Object.freeze([
  PipelineStageIds.Extraction,
  PipelineStageIds.Normalization,
  PipelineStageIds.Transformation,
  PipelineStageIds.Labeling,
  PipelineStageIds.Enrichment,
] as const);

const TabularShapeSchema = z.enum([
  CanonicalDataShapeKinds.records,
  CanonicalDataShapeKinds.table,
]);

export const DocumentChunkingStrategyKinds = Object.freeze({
  character: "character",
  token: "token",
} as const);

export type DocumentChunkingStrategyKind =
  typeof DocumentChunkingStrategyKinds[keyof typeof DocumentChunkingStrategyKinds];

export const TabularCleaningPipelineOptionsSchema = z.object({
  stageOrder: z.array(z.nativeEnum(PipelineStageIds)).optional(),
  includeTransformation: z.boolean().default(true),
  includeFeatureEngineering: z.boolean().default(true),
  includeAggregation: z.boolean().default(false),
  tabularShape: TabularShapeSchema.default(CanonicalDataShapeKinds.records),
  stageConfigOverrides: z.record(z.nativeEnum(PipelineStageIds), z.record(z.any())).optional(),
});

export type TabularCleaningPipelineOptions = z.output<typeof TabularCleaningPipelineOptionsSchema>;

export const DocumentPreparationPipelineOptionsSchema = z.object({
  stageOrder: z.array(z.nativeEnum(PipelineStageIds)).optional(),
  includeLabeling: z.boolean().default(false),
  includeEnrichment: z.boolean().default(false),
  chunkingStrategy: z.enum([
    DocumentChunkingStrategyKinds.character,
    DocumentChunkingStrategyKinds.token,
  ]).default(DocumentChunkingStrategyKinds.character),
  chunkSize: z.number().int().min(1).max(16000).default(500),
  chunkOverlap: z.number().int().min(0).max(8000).default(50),
  tokenizerEncoding: z.string().trim().min(1).default("cl100k_base"),
  stageConfigOverrides: z.record(z.nativeEnum(PipelineStageIds), z.record(z.any())).optional(),
});

export type DocumentPreparationPipelineOptions = z.output<typeof DocumentPreparationPipelineOptionsSchema>;

const ImageTransformOutputFormatSchema = z.enum(["keep", "jpeg", "png", "webp", "avif"]);

export const ImagePreparationPipelineOptionsSchema = z.object({
  stageOrder: z.array(z.nativeEnum(PipelineStageIds)).optional(),
  includeExtraction: z.boolean().default(false),
  includeTransformation: z.boolean().default(false),
  includeLabeling: z.boolean().default(false),
  includeEnrichment: z.boolean().default(false),
  extractionEmitShape: z.enum([
    CanonicalDataShapeKinds.textItems,
    CanonicalDataShapeKinds.imageMetadataRecords,
  ]).default(CanonicalDataShapeKinds.textItems),
  ocrLanguage: z.string().trim().min(1).default("eng"),
  transformResizeWidth: z.number().int().min(1).max(8192).optional(),
  transformResizeHeight: z.number().int().min(1).max(8192).optional(),
  transformGrayscale: z.boolean().default(false),
  transformFormat: ImageTransformOutputFormatSchema.default("keep"),
  normalizeExtractExif: z.boolean().default(true),
  normalizeOrientation: z.boolean().default(true),
  includeFileStats: z.boolean().default(true),
  enrichment: z.object({
    strategy: z.nativeEnum(EnrichmentStrategyKinds).default(EnrichmentStrategyKinds.metadataAugmentation),
    outputFieldPrefix: z.string().trim().min(1).default("enriched"),
    previewSampleSize: z.number().int().min(1).max(1000).default(25),
  }).default({}),
  stageConfigOverrides: z.record(z.nativeEnum(PipelineStageIds), z.record(z.any())).optional(),
});

export type ImagePreparationPipelineOptions = z.output<typeof ImagePreparationPipelineOptionsSchema>;

export interface MidLevelPipelineDefinition {
  readonly pipelineAssetId: string;
  readonly definition: PipelineDefinition;
  readonly stageCompositions: ReadonlyArray<StageCompositionDefinition>;
  readonly buildGraph: (overrides?: Partial<BuildPipelineGraphInput>) => ReturnType<typeof buildPipelineGraph>;
  readonly buildReactFlowGraph: (overrides?: Partial<BuildPipelineGraphInput>) => ReturnType<typeof buildReactFlowGraph>;
  readonly createInspectionService: () => PipelineInspectionService;
}

function assertAllowedStages(
  stageOrder: ReadonlyArray<PipelineStageId>,
  allowed: ReadonlyArray<PipelineStageId>,
  label: string,
): void {
  const allowedSet = new Set(allowed);
  for (const stageId of stageOrder) {
    if (!allowedSet.has(stageId)) {
      throw new Error(`${label} contains unsupported stage '${stageId}'.`);
    }
  }
}

function assertUniqueStageOrder(stageOrder: ReadonlyArray<PipelineStageId>, label: string): void {
  const deduped = new Set(stageOrder);
  if (deduped.size !== stageOrder.length) {
    throw new Error(`${label} contains duplicate stage ids.`);
  }
}

function resolveTabularStageOrder(options: TabularCleaningPipelineOptions): ReadonlyArray<PipelineStageId> {
  const requested = options.stageOrder
    ? options.stageOrder
    : DefaultTabularStageOrder.filter((stageId) => {
      if (stageId === PipelineStageIds.Transformation) {
        return options.includeTransformation;
      }
      if (stageId === PipelineStageIds.FeatureEngineering) {
        return options.includeFeatureEngineering;
      }
      if (stageId === PipelineStageIds.Aggregation) {
        return options.includeAggregation;
      }
      return true;
    });

  assertAllowedStages(requested, TabularStageIds, "TabularCleaningPipelineDefinition.stageOrder");
  assertUniqueStageOrder(requested, "TabularCleaningPipelineDefinition.stageOrder");

  if (!requested.includes(PipelineStageIds.Normalization) || !requested.includes(PipelineStageIds.Cleaning)) {
    throw new Error("Tabular cleaning pipeline requires both Normalization and Cleaning stages.");
  }

  const normalizationIndex = requested.indexOf(PipelineStageIds.Normalization);
  const cleaningIndex = requested.indexOf(PipelineStageIds.Cleaning);
  if (cleaningIndex <= normalizationIndex) {
    throw new Error("Tabular cleaning pipeline requires Normalization before Cleaning.");
  }

  const transformationIndex = requested.indexOf(PipelineStageIds.Transformation);
  if (transformationIndex >= 0 && transformationIndex <= cleaningIndex) {
    throw new Error("Tabular cleaning pipeline requires Transformation to run after Cleaning.");
  }

  const aggregationIndex = requested.indexOf(PipelineStageIds.Aggregation);
  const featureEngineeringIndex = requested.indexOf(PipelineStageIds.FeatureEngineering);
  if (featureEngineeringIndex >= 0) {
    if (transformationIndex < 0) {
      throw new Error("Tabular cleaning pipeline requires Transformation when FeatureEngineering is enabled.");
    }
    if (featureEngineeringIndex <= transformationIndex) {
      throw new Error("Tabular cleaning pipeline requires FeatureEngineering to run after Transformation.");
    }
  }
  if (aggregationIndex >= 0) {
    if (aggregationIndex <= cleaningIndex) {
      throw new Error("Tabular cleaning pipeline requires Aggregation to run after Cleaning.");
    }
    const aggregationPivot = featureEngineeringIndex >= 0 ? featureEngineeringIndex : transformationIndex;
    if (aggregationPivot >= 0 && aggregationIndex <= aggregationPivot) {
      throw new Error("Tabular cleaning pipeline requires Aggregation to run after prior feature/transformation stages.");
    }
  }

  return Object.freeze([...requested]);
}

function resolveDocumentStageOrder(options: DocumentPreparationPipelineOptions): ReadonlyArray<PipelineStageId> {
  const requested = options.stageOrder
    ? options.stageOrder
    : DefaultDocumentStageOrder.filter((stageId) => {
      if (stageId === PipelineStageIds.Labeling) {
        return options.includeLabeling;
      }
      if (stageId === PipelineStageIds.Enrichment) {
        return options.includeEnrichment;
      }
      return true;
    });

  assertAllowedStages(requested, DocumentStageIds, "DocumentPreparationPipelineDefinition.stageOrder");
  assertUniqueStageOrder(requested, "DocumentPreparationPipelineDefinition.stageOrder");

  const required = [PipelineStageIds.Extraction, PipelineStageIds.Normalization, PipelineStageIds.Chunking];
  for (const stageId of required) {
    if (!requested.includes(stageId)) {
      throw new Error(`Document preparation pipeline requires '${stageId}'.`);
    }
  }

  const extractionIndex = requested.indexOf(PipelineStageIds.Extraction);
  const normalizationIndex = requested.indexOf(PipelineStageIds.Normalization);
  const chunkingIndex = requested.indexOf(PipelineStageIds.Chunking);

  if (normalizationIndex <= extractionIndex) {
    throw new Error("Document preparation pipeline requires Normalization after Extraction.");
  }
  if (chunkingIndex <= normalizationIndex) {
    throw new Error("Document preparation pipeline requires Chunking after Normalization.");
  }

  const labelingIndex = requested.indexOf(PipelineStageIds.Labeling);
  if (labelingIndex >= 0 && labelingIndex <= chunkingIndex) {
    throw new Error("Document preparation pipeline requires Labeling to run after Chunking.");
  }

  const enrichmentIndex = requested.indexOf(PipelineStageIds.Enrichment);
  if (enrichmentIndex >= 0 && enrichmentIndex <= chunkingIndex) {
    throw new Error("Document preparation pipeline requires Enrichment to run after Chunking.");
  }

  return Object.freeze([...requested]);
}

function resolveImageStageOrder(options: ImagePreparationPipelineOptions): ReadonlyArray<PipelineStageId> {
  const requested = options.stageOrder
    ? options.stageOrder
    : DefaultImageStageOrder.filter((stageId) => {
      if (stageId === PipelineStageIds.Extraction) {
        return options.includeExtraction;
      }
      if (stageId === PipelineStageIds.Transformation) {
        return options.includeTransformation;
      }
      if (stageId === PipelineStageIds.Labeling) {
        return options.includeLabeling;
      }
      if (stageId === PipelineStageIds.Enrichment) {
        return options.includeEnrichment;
      }
      return true;
    });

  assertAllowedStages(requested, ImageStageIds, "ImagePreparationPipelineDefinition.stageOrder");
  assertUniqueStageOrder(requested, "ImagePreparationPipelineDefinition.stageOrder");

  if (!requested.includes(PipelineStageIds.Normalization)) {
    throw new Error("Image preparation pipeline requires Normalization.");
  }

  const normalizationIndex = requested.indexOf(PipelineStageIds.Normalization);
  const extractionIndex = requested.indexOf(PipelineStageIds.Extraction);
  if (extractionIndex >= 0 && extractionIndex > normalizationIndex) {
    throw new Error("Image preparation pipeline requires Extraction to run before Normalization.");
  }

  const transformationIndex = requested.indexOf(PipelineStageIds.Transformation);
  if (transformationIndex >= 0 && transformationIndex <= normalizationIndex) {
    throw new Error("Image preparation pipeline requires Transformation to run after Normalization.");
  }

  const labelingIndex = requested.indexOf(PipelineStageIds.Labeling);
  if (labelingIndex >= 0 && transformationIndex >= 0 && labelingIndex <= transformationIndex) {
    throw new Error("Image preparation pipeline requires Labeling to run after Transformation.");
  }

  const enrichmentIndex = requested.indexOf(PipelineStageIds.Enrichment);
  if (enrichmentIndex >= 0) {
    const pivot = labelingIndex >= 0 ? labelingIndex : transformationIndex >= 0 ? transformationIndex : normalizationIndex;
    if (enrichmentIndex <= pivot) {
      throw new Error("Image preparation pipeline requires Enrichment to run after prior processing stages.");
    }
  }

  return Object.freeze([...requested]);
}

function mergeConfig(
  stageId: PipelineStageId,
  defaults: Readonly<Record<string, CanonicalRecordValue>>,
  overrides: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>> | undefined,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({
    ...defaults,
    ...(overrides?.[stageId] ?? {}),
  });
}
function toPipelineDefinition(input: {
  readonly stageOrder: ReadonlyArray<PipelineStageId>;
  readonly tabularShape?: z.output<typeof TabularShapeSchema>;
  readonly stageConfigOverrides?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly isDocument?: boolean;
  readonly documentOptions?: DocumentPreparationPipelineOptions;
}): PipelineDefinition {
  const registry = new PipelineStageRegistry();

  const instances = input.stageOrder.map((stageId): PipelineStageInstance => {
    const definition = registry.getDefinition(stageId);
    const defaultOptions: Record<string, CanonicalRecordValue> = {};

    if (stageId === PipelineStageIds.Normalization) {
      defaultOptions.trimStrings = true;
      defaultOptions.emptyStringAsNull = true;
      defaultOptions.onConversionFailure = "preserve";
      if (!input.isDocument) {
        defaultOptions.normalizeHeadersToLowercase = true;
      }
    }
    if (stageId === PipelineStageIds.Cleaning) {
      defaultOptions.missingStrategy = "fill-default";
      defaultOptions.treatEmptyStringAsMissing = true;
      defaultOptions.treatWhitespaceAsMissing = true;
      defaultOptions.dedupeMode = "exact-all";
      defaultOptions.keepStrategy = "keep-first";
    }
    if (stageId === PipelineStageIds.Transformation) {
      defaultOptions.invalidRowStrategy = "annotate-and-keep";
      defaultOptions.preserveUnmapped = true;
      defaultOptions.dropEmptyTargets = false;
    }
    if (stageId === PipelineStageIds.FeatureEngineering) {
      Object.assign(defaultOptions, toFeatureEngineeringStageOptions(createFeatureEngineeringStageConfig({
        strategy: FeatureEngineeringStrategyKinds.structured,
        outputFieldPrefix: "feature",
        preserveSourceFields: true,
        enforceTypeValidation: true,
        operations: Object.freeze([]),
      })));
      defaultOptions.featureProjectionFields = Object.freeze([]);
    }
    if (stageId === PipelineStageIds.Aggregation) {
      defaultOptions.groupByFields = Object.freeze([]);
      defaultOptions.nullHandlingMode = "exclude";
    }
    if (stageId === PipelineStageIds.Extraction) {
      defaultOptions.extractionMode = "auto";
      defaultOptions.includePageText = true;
      defaultOptions.maxPages = 100;
      defaultOptions.ocrLanguage = "eng";
    }
    if (stageId === PipelineStageIds.Chunking && input.documentOptions) {
      defaultOptions.chunkingStrategy = input.documentOptions.chunkingStrategy;
      defaultOptions.chunkSize = input.documentOptions.chunkSize;
      defaultOptions.chunkOverlap = input.documentOptions.chunkOverlap;
      defaultOptions.tokenizerEncoding = input.documentOptions.tokenizerEncoding;
    }
    if (stageId === PipelineStageIds.Labeling) {
      const target = input.isDocument
        ? AnnotationTargetKinds.chunk
        : AnnotationTargetKinds.record;
      Object.assign(defaultOptions, toLabelingStageOptions(createLabelingStageConfig({
        mode: AnnotationModeKinds.automaticPlaceholder,
        target,
        attachmentMode: input.isDocument ? "associated" : "embedded",
        allowMultiLabel: false,
        allowFreeText: true,
        confidenceEnabled: true,
        emitManualNeeded: true,
        emitStatusField: true,
      })));
    }
    if (stageId === PipelineStageIds.Enrichment) {
      const enrichmentDefaults = toEnrichmentStageOptions(createEnrichmentStageConfig({
        strategy: EnrichmentStrategyKinds.metadataAugmentation,
        metadataAugmentation: {
          includeImageMetadata: true,
          includeDocumentStats: true,
          includeProfiling: true,
        },
      }));
      Object.assign(defaultOptions, enrichmentDefaults);
    }

    const options = mergeConfig(
      stageId,
      Object.freeze(defaultOptions),
      input.stageConfigOverrides,
    );

    const declaredInputType = input.isDocument
      ? CanonicalDataShapeKinds.textItems
      : input.tabularShape;
    const expectedOutputType = input.isDocument
      ? CanonicalDataShapeKinds.textItems
      : input.tabularShape;

    const stageInstance = createPipelineStageInstance({
      definition,
      config: {
        mode: PipelineStageConfigModes.advanced,
        declaredInputType,
        expectedOutputType,
        options,
      },
      metadata: {
        inspectable: true,
      },
    });

    if (
      input.isDocument
      && stageId === PipelineStageIds.Extraction
    ) {
      return Object.freeze({
        ...stageInstance,
        config: Object.freeze({
          ...stageInstance.config,
          declaredInputType: undefined,
          expectedOutputType: CanonicalDataShapeKinds.textItems,
        }),
      });
    }

    return stageInstance;
  });

  const transitions = Object.freeze(instances.slice(0, -1).map((stage, index) => {
    const next = instances[index + 1];
    if (!next) {
      throw new Error(`Unable to resolve pipeline transition for '${stage.stageId}'.`);
    }
    return Object.freeze({ fromStageId: stage.stageId, toStageId: next.stageId });
  }));

  return validatePipelineDefinition(Object.freeze({
    stageInstances: Object.freeze(instances),
    transitions,
  }));
}

function toImagePipelineDefinition(input: {
  readonly stageOrder: ReadonlyArray<PipelineStageId>;
  readonly options: ImagePreparationPipelineOptions;
}): PipelineDefinition {
  const registry = new PipelineStageRegistry();
  const enrichmentConfig = createEnrichmentStageConfig({
    strategy: input.options.enrichment.strategy,
    outputFieldPrefix: input.options.enrichment.outputFieldPrefix,
    previewSampleSize: input.options.enrichment.previewSampleSize,
    derivedFields: input.options.enrichment.strategy === EnrichmentStrategyKinds.derived
      ? Object.freeze([
        Object.freeze({
          targetField: "derived.has_ocr_text",
          expression: "ocrTextLength > 0",
          sourceFields: Object.freeze(["ocrTextLength"]),
          fallbackValue: false,
        }),
      ])
      : undefined,
    lookup: input.options.enrichment.strategy === EnrichmentStrategyKinds.lookup
      ? Object.freeze({
        inputKey: "imageId",
        lookupKey: "imageId",
        joinType: "left",
        preserveUnmatched: true,
      })
      : undefined,
    metadataAugmentation: input.options.enrichment.strategy === EnrichmentStrategyKinds.metadataAugmentation
      ? Object.freeze({
        includeImageMetadata: true,
        includeDocumentStats: true,
        includeProfiling: true,
      })
      : undefined,
  });

  const instances = input.stageOrder.map((stageId): PipelineStageInstance => {
    const definition = registry.getDefinition(stageId);
    const defaults: Record<string, CanonicalRecordValue> = {};

    if (stageId === PipelineStageIds.Extraction) {
      defaults.performOcr = true;
      defaults.ocrLanguage = input.options.ocrLanguage;
      defaults.extractionEmitShape = input.options.extractionEmitShape;
    }
    if (stageId === PipelineStageIds.Normalization) {
      defaults.extractExif = input.options.normalizeExtractExif;
      defaults.normalizeOrientation = input.options.normalizeOrientation;
      defaults.includeFileStats = input.options.includeFileStats;
      defaults.metadataShape = CanonicalDataShapeKinds.imageMetadataRecords;
    }
    if (stageId === PipelineStageIds.Transformation) {
      defaults.resizeWidth = input.options.transformResizeWidth ?? null;
      defaults.resizeHeight = input.options.transformResizeHeight ?? null;
      defaults.grayscale = input.options.transformGrayscale;
      defaults.targetFormat = input.options.transformFormat;
      defaults.transformationEnabled = true;
    }
    if (stageId === PipelineStageIds.Labeling) {
      Object.assign(defaults, toLabelingStageOptions(createLabelingStageConfig({
        mode: AnnotationModeKinds.automaticPlaceholder,
        target: AnnotationTargetKinds.imageRecord,
        attachmentMode: "embedded",
        allowMultiLabel: true,
        allowFreeText: true,
        confidenceEnabled: true,
        emitManualNeeded: true,
        emitStatusField: true,
        assistedSeedFromClassification: true,
        assistanceProvider: "data-classification",
      })));
      defaults.emitRecordLevelTags = true;
      defaults.emitImageTags = true;
    }
    if (stageId === PipelineStageIds.Enrichment) {
      Object.assign(defaults, toEnrichmentStageOptions(enrichmentConfig));
    }

    const options = mergeConfig(stageId, Object.freeze(defaults), input.options.stageConfigOverrides);
    const overrideEnrichment = stageId === PipelineStageIds.Enrichment
      ? parseEnrichmentStageConfigFromStageOptions(options)
      : undefined;
    const normalizedOptions = stageId === PipelineStageIds.Enrichment
      ? Object.freeze({
        ...options,
        ...toEnrichmentStageOptions(overrideEnrichment as EnrichmentStageConfig),
      })
      : options;

    const declaredInputType = stageId === PipelineStageIds.Extraction
      ? CanonicalDataShapeKinds.imageMetadataRecords
      : stageId === PipelineStageIds.Normalization
        ? input.options.includeExtraction
          ? input.options.extractionEmitShape
          : CanonicalDataShapeKinds.imageMetadataRecords
        : CanonicalDataShapeKinds.imageMetadataRecords;

    const expectedOutputType = stageId === PipelineStageIds.Extraction
      ? input.options.extractionEmitShape
      : CanonicalDataShapeKinds.imageMetadataRecords;

    return createPipelineStageInstance({
      definition,
      config: {
        mode: PipelineStageConfigModes.advanced,
        declaredInputType,
        expectedOutputType,
        options: normalizedOptions,
      },
      metadata: {
        inspectable: true,
      },
    });
  });

  const transitions = Object.freeze(instances.slice(0, -1).map((stage, index) => {
    const next = instances[index + 1];
    if (!next) {
      throw new Error(`Unable to resolve image pipeline transition for '${stage.stageId}'.`);
    }
    return Object.freeze({ fromStageId: stage.stageId, toStageId: next.stageId });
  }));

  return validatePipelineDefinition(Object.freeze({
    stageInstances: Object.freeze(instances),
    transitions,
  }));
}

function createPipelineDefinitionWrapper(input: {
  readonly pipelineAssetId: string;
  readonly definition: PipelineDefinition;
  readonly stageCompositions: ReadonlyArray<StageCompositionDefinition>;
  readonly inspectionHooks: PipelineInspectionHooks;
}): MidLevelPipelineDefinition {
  return Object.freeze({
    pipelineAssetId: input.pipelineAssetId,
    definition: input.definition,
    stageCompositions: input.stageCompositions,
    buildGraph: (overrides) => buildPipelineGraph({
      stageInstances: input.definition.stageInstances,
      transitions: input.definition.transitions,
      explicitBranchingStageIds: input.definition.explicitBranchingStageIds,
      stageCompositions: input.stageCompositions,
      ...(overrides ?? {}),
    }),
    buildReactFlowGraph: (overrides) => {
      const graph = buildPipelineGraph({
        stageInstances: input.definition.stageInstances,
        transitions: input.definition.transitions,
        explicitBranchingStageIds: input.definition.explicitBranchingStageIds,
        stageCompositions: input.stageCompositions,
        ...(overrides ?? {}),
      });
      return buildReactFlowGraph(graph);
    },
    createInspectionService: () => new PipelineInspectionService({ hooks: input.inspectionHooks }),
  });
}

function collectNumericSummary(shape: CanonicalDataShape): Readonly<Record<string, CanonicalRecordValue>> {
  const valuesByField = new Map<string, number[]>();

  const collectFromRow = (row: Readonly<Record<string, CanonicalRecordValue>>) => {
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        valuesByField.set(field, [...(valuesByField.get(field) ?? []), value]);
        continue;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          valuesByField.set(field, [...(valuesByField.get(field) ?? []), parsed]);
        }
      }
    }
  };

  if (shape.kind === CanonicalDataShapeKinds.records) {
    for (const record of shape.records) {
      collectFromRow(record.fields);
    }
  }
  if (shape.kind === CanonicalDataShapeKinds.table) {
    for (const row of shape.rows) {
      collectFromRow(row.cells);
    }
  }

  const summary: Record<string, CanonicalRecordValue> = {};
  for (const [field, values] of valuesByField.entries()) {
    const stats = summarizeNumericValues(values, { singleValueStandardDeviationZero: true });
    if (!stats) {
      continue;
    }
    summary[`numeric.${field}.count`] = stats.count;
    summary[`numeric.${field}.mean`] = Number(stats.mean.toFixed(6));
    summary[`numeric.${field}.median`] = Number(stats.median.toFixed(6));
    summary[`numeric.${field}.min`] = stats.min;
    summary[`numeric.${field}.max`] = stats.max;
  }

  return Object.freeze(summary);
}

const encodingCache = new Map<string, ReturnType<typeof getEncoding>>();

function getTokenizer(encodingName: string) {
  const cached = encodingCache.get(encodingName);
  if (cached) {
    return cached;
  }
  const encoding = getEncoding(encodingName as TiktokenEncoding);
  encodingCache.set(encodingName, encoding);
  return encoding;
}

function estimateTokenCount(text: string, encodingName: string): number | undefined {
  try {
    return getTokenizer(encodingName).encode(text).length;
  } catch {
    return undefined;
  }
}

function createTabularInspectionHooks(): PipelineInspectionHooks {
  return Object.freeze({
    stage: Object.freeze([
      (context) => {
        if (!isCanonicalDataShape(context.stageOutput)) {
          return undefined;
        }
        if (
          context.stageOutput.kind !== CanonicalDataShapeKinds.records
          && context.stageOutput.kind !== CanonicalDataShapeKinds.table
        ) {
          return undefined;
        }

        return Object.freeze({
          summaryStats: Object.freeze({
            rowSampleCount: context.stageOutput.kind === CanonicalDataShapeKinds.records
              ? Math.min(10, context.stageOutput.records.length)
              : Math.min(10, context.stageOutput.rows.length),
            schemaSnapshotCaptured: true,
            ...collectNumericSummary(context.stageOutput),
          }),
        });
      },
    ]),
  });
}

function createDocumentInspectionHooks(): PipelineInspectionHooks {
  return Object.freeze({
    stage: Object.freeze([
      (context) => {
        if (!isCanonicalDataShape(context.stageOutput) || context.stageOutput.kind !== CanonicalDataShapeKinds.textItems) {
          return undefined;
        }

        const excerpt = context.stageOutput.items
          .slice(0, 2)
          .map((item) => item.text.slice(0, 160));
        const combinedText = context.stageOutput.items.map((item) => item.text).join("\n");
        const chunkingEncoding = typeof context.stageNode.data.config.options.tokenizerEncoding === "string"
          ? context.stageNode.data.config.options.tokenizerEncoding
          : "cl100k_base";

        return Object.freeze({
          summaryStats: Object.freeze({
            extractedTextPreview: Object.freeze(excerpt),
            extractedCharCount: combinedText.length,
            chunkCount: context.stageOutput.items.length,
            tokenCount: estimateTokenCount(combinedText, chunkingEncoding),
          }),
        });
      },
    ]),
  });
}

function createImageInspectionHooks(): PipelineInspectionHooks {
  return Object.freeze({
    stage: Object.freeze([
      (context) => {
        if (!isCanonicalDataShape(context.stageOutput)) {
          return undefined;
        }

        if (context.stageOutput.kind === CanonicalDataShapeKinds.imageMetadataRecords) {
          const dimensions = context.stageOutput.items
            .slice(0, 3)
            .map((item) => {
              const width = typeof item.attributes?.width === "number" ? item.attributes.width : undefined;
              const height = typeof item.attributes?.height === "number" ? item.attributes.height : undefined;
              const format = typeof item.attributes?.format === "string" ? item.attributes.format : undefined;
              return Object.freeze({
                imageId: item.imageId ?? item.itemId,
                width,
                height,
                format,
              });
            });

          return Object.freeze({
            summaryStats: Object.freeze({
              imageCount: context.stageOutput.items.length,
              imageMetadataPreview: Object.freeze(dimensions),
            }),
          });
        }

        if (context.stageOutput.kind === CanonicalDataShapeKinds.textItems) {
          const preview = context.stageOutput.items.slice(0, 2).map((item) => item.text.slice(0, 180));
          return Object.freeze({
            summaryStats: Object.freeze({
              ocrItemCount: context.stageOutput.items.length,
              ocrTextPreview: Object.freeze(preview),
            }),
          });
        }

        return undefined;
      },
    ]),
  });
}

function createComposableEnrichmentStageDefinition(
  input: {
    readonly idPrefix: string;
    readonly defaultConfig?: Partial<EnrichmentStageConfig>;
  },
): StageCompositionDefinition {
  const defaults = createEnrichmentStageConfig({
    strategy: EnrichmentStrategyKinds.metadataAugmentation,
    metadataAugmentation: {
      includeImageMetadata: true,
      includeDocumentStats: true,
      includeProfiling: true,
    },
    ...(input.defaultConfig ?? {}),
  });
  const defaultsAsOptions = toEnrichmentStageOptions(defaults);

  return Object.freeze({
    stageId: PipelineStageIds.Enrichment,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: `${input.idPrefix}-enrichment-derived`,
        executionOrder: 1,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ enrichmentStrategy: EnrichmentStrategyKinds.derived }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "derived-field-compute",
            configMapping: Object.freeze([
              { stageConfigKey: "derivedFields", assetConfigKey: "derivedFields", defaultValue: defaultsAsOptions.derivedFields },
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: defaults.outputFieldPrefix },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "derived-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: defaults.outputFieldPrefix },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: `${input.idPrefix}-enrichment-lookup`,
        executionOrder: 1,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ enrichmentStrategy: EnrichmentStrategyKinds.lookup }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "lookup-source",
            configMapping: Object.freeze([
              { stageConfigKey: "lookupSourceAssetId", assetConfigKey: "sourceAssetId" },
              { stageConfigKey: "lookupSourceReference", assetConfigKey: "sourceReference" },
              { stageConfigKey: "lookupInputKey", assetConfigKey: "inputKey", defaultValue: "id" },
              { stageConfigKey: "lookupLookupKey", assetConfigKey: "lookupKey", defaultValue: "id" },
              { stageConfigKey: "lookupJoinType", assetConfigKey: "joinType", defaultValue: "left" },
              { stageConfigKey: "lookupSelectedFields", assetConfigKey: "selectedFields", defaultValue: Object.freeze([]) },
              { stageConfigKey: "lookupPreserveUnmatched", assetConfigKey: "preserveUnmatched", defaultValue: true },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "lookup-transform",
            configMapping: Object.freeze([
              { stageConfigKey: "lookupSelectedFields", assetConfigKey: "selectedFields", defaultValue: Object.freeze([]) },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "lookup-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: defaults.outputFieldPrefix },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: `${input.idPrefix}-enrichment-metadata`,
        executionOrder: 1,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ enrichmentStrategy: EnrichmentStrategyKinds.metadataAugmentation }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataProfiling,
            version: "1.0.0",
            role: "metadata-profile",
            configMapping: Object.freeze([
              { stageConfigKey: "previewSampleSize", assetConfigKey: "sampleSize", defaultValue: defaults.previewSampleSize },
              { stageConfigKey: "metadataIncludeProfiling", assetConfigKey: "enabled", defaultValue: true },
            ]),
          }),
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-metadata-augmentation",
            condition: Object.freeze({ inputTypes: Object.freeze([CanonicalDataShapeKinds.imageMetadataRecords]) }),
            configMapping: Object.freeze([
              { stageConfigKey: "metadataIncludeImageMetadata", assetConfigKey: "extractExif", defaultValue: true },
              { stageConfigKey: "metadataIncludeImageMetadata", assetConfigKey: "generatePreviewMetadata", defaultValue: true },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "metadata-merge",
            configMapping: Object.freeze([
              { stageConfigKey: "metadataStaticFields", assetConfigKey: "staticFields", defaultValue: Object.freeze({}) },
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: defaults.outputFieldPrefix },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: `${input.idPrefix}-enrichment-fallback`,
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "enrichment-fallback",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichedFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: defaults.outputFieldPrefix },
            ]),
          }),
        ]),
      }),
    ]),
  });
}
export const TabularCleaningStageCompositionDefinitions: ReadonlyArray<StageCompositionDefinition> = Object.freeze([
  Object.freeze({
    stageId: PipelineStageIds.Normalization,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "tabular-normalization",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.typeNormalization,
            version: "1.0.0",
            role: "type-normalizer",
            configMapping: Object.freeze([
              { stageConfigKey: "trimStrings", assetConfigKey: "trimStrings", defaultValue: true },
              { stageConfigKey: "emptyStringAsNull", assetConfigKey: "emptyStringAsNull", defaultValue: true },
              { stageConfigKey: "onConversionFailure", assetConfigKey: "onConversionFailure", defaultValue: "preserve" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Cleaning,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "tabular-cleaning",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.missingValueHandling,
            version: "1.0.0",
            role: "missing-value-handler",
            configMapping: Object.freeze([
              { stageConfigKey: "missingStrategy", assetConfigKey: "strategy", defaultValue: "fill-default" },
              { stageConfigKey: "treatEmptyStringAsMissing", assetConfigKey: "treatEmptyStringAsMissing", defaultValue: true },
              { stageConfigKey: "treatWhitespaceAsMissing", assetConfigKey: "treatWhitespaceAsMissing", defaultValue: true },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.deduplication,
            version: "1.0.0",
            role: "deduplicator",
            configMapping: Object.freeze([
              { stageConfigKey: "dedupeMode", assetConfigKey: "mode", defaultValue: "exact-all" },
              { stageConfigKey: "keepStrategy", assetConfigKey: "keepStrategy", defaultValue: "keep-first" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Transformation,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "tabular-transformation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "field-mapper",
            configMapping: Object.freeze([
              { stageConfigKey: "preserveUnmapped", assetConfigKey: "preserveUnmapped", defaultValue: true },
              { stageConfigKey: "dropEmptyTargets", assetConfigKey: "dropEmptyTargets", defaultValue: false },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataValidation,
            version: "1.0.0",
            role: "validator",
            configMapping: Object.freeze([
              { stageConfigKey: "invalidRowStrategy", assetConfigKey: "invalidRowStrategy", defaultValue: "annotate-and-keep" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.FeatureEngineering,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "tabular-feature-normalization",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.typeNormalization,
            version: "1.0.0",
            role: "feature-input-normalization",
            configMapping: Object.freeze([
              { stageConfigKey: "trimStrings", assetConfigKey: "trimStrings", defaultValue: true },
              { stageConfigKey: "emptyStringAsNull", assetConfigKey: "emptyStringAsNull", defaultValue: false },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "tabular-feature-generation",
        executionOrder: 2,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "feature-generator",
            configMapping: Object.freeze([
              { stageConfigKey: "featureStrategy", assetConfigKey: "featureStrategy", defaultValue: "structured" },
              { stageConfigKey: "featureOperations", assetConfigKey: "featureOperations", defaultValue: Object.freeze([]) },
              { stageConfigKey: "featureOutputFieldPrefix", assetConfigKey: "outputFieldPrefix", defaultValue: "feature" },
              { stageConfigKey: "featurePreserveSourceFields", assetConfigKey: "preserveSourceFields", defaultValue: true },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataValidation,
            version: "1.0.0",
            role: "feature-validator",
            configMapping: Object.freeze([
              { stageConfigKey: "featureEnforceTypeValidation", assetConfigKey: "enabled", defaultValue: true },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "tabular-feature-projection",
        executionOrder: 3,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "feature-projection",
            configMapping: Object.freeze([
              { stageConfigKey: "featureProjectionFields", assetConfigKey: "selectedFields", defaultValue: Object.freeze([]) },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Aggregation,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "tabular-aggregation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.aggregation,
            version: "1.0.0",
            role: "aggregator",
            configMapping: Object.freeze([
              { stageConfigKey: "groupByFields", assetConfigKey: "groupByFields", defaultValue: Object.freeze([]) },
              { stageConfigKey: "nullHandlingMode", assetConfigKey: "nullHandlingMode", defaultValue: "exclude" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
]);

export const DocumentPreparationStageCompositionDefinitions: ReadonlyArray<StageCompositionDefinition> = Object.freeze([
  Object.freeze({
    stageId: PipelineStageIds.Extraction,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "document-extraction",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.document,
            version: "1.0.0",
            role: "pdf-text-extractor",
            condition: Object.freeze({ optionEquals: Object.freeze({ extractionMode: "pdf" }) }),
            configMapping: Object.freeze([
              { stageConfigKey: "includePageText", assetConfigKey: "includePageText", defaultValue: true },
              { stageConfigKey: "maxPages", assetConfigKey: "maxPages", defaultValue: 100 },
            ]),
          }),
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-ocr-extractor",
            condition: Object.freeze({ optionEquals: Object.freeze({ extractionMode: "image" }) }),
            configMapping: Object.freeze([
              { stageConfigKey: "ocrLanguage", assetConfigKey: "ocrLanguage", defaultValue: "eng" },
            ]),
          }),
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.document,
            version: "1.0.0",
            role: "auto-extractor",
            configMapping: Object.freeze([]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Normalization,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "document-normalization",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.typeNormalization,
            version: "1.0.0",
            role: "text-normalizer",
            configMapping: Object.freeze([
              { stageConfigKey: "trimStrings", assetConfigKey: "trimStrings", defaultValue: true },
              { stageConfigKey: "emptyStringAsNull", assetConfigKey: "emptyStringAsNull", defaultValue: false },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Chunking,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "document-chunking",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "character-chunker",
            condition: Object.freeze({ optionEquals: Object.freeze({ chunkingStrategy: DocumentChunkingStrategyKinds.character }) }),
            configMapping: Object.freeze([
              { stageConfigKey: "chunkSize", assetConfigKey: "chunkSize", defaultValue: 500 },
              { stageConfigKey: "chunkOverlap", assetConfigKey: "chunkOverlap", defaultValue: 50 },
            ]),
          }),
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "token-chunker",
            condition: Object.freeze({ optionEquals: Object.freeze({ chunkingStrategy: DocumentChunkingStrategyKinds.token }) }),
            configMapping: Object.freeze([
              { stageConfigKey: "chunkSize", assetConfigKey: "chunkSize", defaultValue: 500 },
              { stageConfigKey: "chunkOverlap", assetConfigKey: "chunkOverlap", defaultValue: 50 },
              { stageConfigKey: "tokenizerEncoding", assetConfigKey: "tokenizerEncoding", defaultValue: "cl100k_base" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Labeling,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "document-annotation-target-preparation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "document-annotation-target-preparer",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationTarget", assetConfigKey: "annotationTarget", defaultValue: "chunk" },
              { stageConfigKey: "annotationAttachmentMode", assetConfigKey: "annotationAttachmentMode", defaultValue: "associated" },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "document-annotation-attach-and-validate",
        executionOrder: 2,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "document-annotation-attacher",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationRecords", assetConfigKey: "annotationRecords", defaultValue: Object.freeze([]) },
              { stageConfigKey: "annotationAllowMultiLabel", assetConfigKey: "allowMultiLabel", defaultValue: false },
              { stageConfigKey: "annotationAllowFreeText", assetConfigKey: "allowFreeText", defaultValue: true },
              { stageConfigKey: "annotationAllowedLabels", assetConfigKey: "allowedLabels", defaultValue: Object.freeze([]) },
              { stageConfigKey: "annotationConfidenceEnabled", assetConfigKey: "confidenceEnabled", defaultValue: true },
              { stageConfigKey: "annotationSourceLabel", assetConfigKey: "sourceLabel", defaultValue: "manual" },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataValidation,
            version: "1.0.0",
            role: "document-annotation-validator",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationEmitStatusField", assetConfigKey: "emitStatusField", defaultValue: true },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  createComposableEnrichmentStageDefinition({
    idPrefix: "document",
  }),
]);

export const ImagePreparationStageCompositionDefinitions: ReadonlyArray<StageCompositionDefinition> = Object.freeze([
  Object.freeze({
    stageId: PipelineStageIds.Extraction,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "image-extraction",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-ocr-extraction",
            condition: Object.freeze({ optionEquals: Object.freeze({ performOcr: true }) }),
            configMapping: Object.freeze([
              { stageConfigKey: "ocrLanguage", assetConfigKey: "ocrLanguage", defaultValue: "eng" },
              { stageConfigKey: "extractionEmitShape", assetConfigKey: "emitShape", defaultValue: CanonicalDataShapeKinds.textItems },
            ]),
          }),
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-structured-pass-through",
            configMapping: Object.freeze([
              { stageConfigKey: "performOcr", assetConfigKey: "performOcr", defaultValue: false },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Normalization,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "image-normalization",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "image-metadata-normalization",
            configMapping: Object.freeze([
              { stageConfigKey: "extractExif", assetConfigKey: "extractExif", defaultValue: true },
              { stageConfigKey: "normalizeOrientation", assetConfigKey: "normalizeOrientation", defaultValue: true },
              { stageConfigKey: "includeFileStats", assetConfigKey: "includeFileStats", defaultValue: true },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Transformation,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "image-transformation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            version: "1.0.0",
            role: "sharp-image-transform",
            configMapping: Object.freeze([
              { stageConfigKey: "resizeWidth", assetConfigKey: "resizeWidth" },
              { stageConfigKey: "resizeHeight", assetConfigKey: "resizeHeight" },
              { stageConfigKey: "grayscale", assetConfigKey: "grayscale", defaultValue: false },
              { stageConfigKey: "targetFormat", assetConfigKey: "targetFormat", defaultValue: "keep" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Labeling,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "image-annotation-target-preparation",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "image-annotation-target-preparer",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationTarget", assetConfigKey: "annotationTarget", defaultValue: "image-record" },
              { stageConfigKey: "annotationAttachmentMode", assetConfigKey: "annotationAttachmentMode", defaultValue: "embedded" },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "image-annotation-assist-placeholder",
        executionOrder: 2,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ labelingMode: "assisted", annotationAssistedSeedFromClassification: false }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "image-assist-placeholder",
            staticConfig: Object.freeze({
              assistanceContract: "placeholder",
            }),
            configMapping: Object.freeze([
              { stageConfigKey: "labelingMode", assetConfigKey: "labelingMode", defaultValue: "assisted" },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "image-annotation-assist-seed",
        executionOrder: 2,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ labelingMode: "assisted", annotationAssistedSeedFromClassification: true }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataClassification,
            version: "1.0.0",
            role: "image-labeling-placeholder",
            configMapping: Object.freeze([
              { stageConfigKey: "labelingMode", assetConfigKey: "labelingMode", defaultValue: "assisted" },
              { stageConfigKey: "emitImageTags", assetConfigKey: "emitImageTags", defaultValue: true },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "image-annotation-automatic-placeholder",
        executionOrder: 2,
        executionMode: "sequential",
        condition: Object.freeze({ optionEquals: Object.freeze({ labelingMode: "automatic-placeholder" }) }),
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "image-automatic-annotation-placeholder",
            staticConfig: Object.freeze({
              assistanceContract: "automatic-placeholder",
            }),
            configMapping: Object.freeze([
              { stageConfigKey: "annotationEmitManualNeeded", assetConfigKey: "emitManualNeeded", defaultValue: true },
              { stageConfigKey: "annotationEmitStatusField", assetConfigKey: "emitStatusField", defaultValue: true },
            ]),
          }),
        ]),
      }),
      Object.freeze({
        id: "image-annotation-attach-and-validate",
        executionOrder: 3,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "image-annotation-attacher",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationRecords", assetConfigKey: "annotationRecords", defaultValue: Object.freeze([]) },
              { stageConfigKey: "annotationAllowMultiLabel", assetConfigKey: "allowMultiLabel", defaultValue: true },
              { stageConfigKey: "annotationAllowFreeText", assetConfigKey: "allowFreeText", defaultValue: true },
              { stageConfigKey: "annotationAllowedLabels", assetConfigKey: "allowedLabels", defaultValue: Object.freeze([]) },
              { stageConfigKey: "annotationConfidenceEnabled", assetConfigKey: "confidenceEnabled", defaultValue: true },
              { stageConfigKey: "annotationSourceLabel", assetConfigKey: "sourceLabel", defaultValue: "manual" },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataValidation,
            version: "1.0.0",
            role: "image-annotation-validator",
            configMapping: Object.freeze([
              { stageConfigKey: "annotationEmitStatusField", assetConfigKey: "emitStatusField", defaultValue: true },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  createComposableEnrichmentStageDefinition({
    idPrefix: "image",
  }),
]);

export function createTabularCleaningPipelineDefinition(
  input?: Partial<TabularCleaningPipelineOptions>,
): MidLevelPipelineDefinition {
  const options = TabularCleaningPipelineOptionsSchema.parse(input ?? {});
  const stageOrder = resolveTabularStageOrder(options);
  const definition = toPipelineDefinition({
    stageOrder,
    tabularShape: options.tabularShape,
    stageConfigOverrides: options.stageConfigOverrides,
  });

  return createPipelineDefinitionWrapper({
    pipelineAssetId: "pipeline.tabular-cleaning.v1",
    definition,
    stageCompositions: TabularCleaningStageCompositionDefinitions,
    inspectionHooks: createTabularInspectionHooks(),
  });
}

export const TabularCleaningPipelineDefinition = createTabularCleaningPipelineDefinition();

export function createDocumentPreparationPipelineDefinition(
  input?: Partial<DocumentPreparationPipelineOptions>,
): MidLevelPipelineDefinition {
  const options = DocumentPreparationPipelineOptionsSchema.parse(input ?? {});
  const stageOrder = resolveDocumentStageOrder(options);
  const definition = toPipelineDefinition({
    stageOrder,
    isDocument: true,
    documentOptions: options,
    stageConfigOverrides: options.stageConfigOverrides,
  });

  return createPipelineDefinitionWrapper({
    pipelineAssetId: "pipeline.document-preparation.v1",
    definition,
    stageCompositions: DocumentPreparationStageCompositionDefinitions,
    inspectionHooks: createDocumentInspectionHooks(),
  });
}

export const DocumentPreparationPipelineDefinition = createDocumentPreparationPipelineDefinition();

export function createImagePreparationPipelineDefinition(
  input?: Partial<ImagePreparationPipelineOptions>,
): MidLevelPipelineDefinition {
  const options = ImagePreparationPipelineOptionsSchema.parse(input ?? {});
  const stageOrder = resolveImageStageOrder(options);
  const definition = toImagePipelineDefinition({
    stageOrder,
    options,
  });

  return createPipelineDefinitionWrapper({
    pipelineAssetId: "pipeline.image-preparation.v1",
    definition,
    stageCompositions: ImagePreparationStageCompositionDefinitions,
    inspectionHooks: createImageInspectionHooks(),
  });
}

export const ImagePreparationPipelineDefinition = createImagePreparationPipelineDefinition();

export interface IImageOcrExtractor {
  extractText(request: {
    readonly payload: Uint8Array;
    readonly language: string;
  }): Promise<string>;
}

export class TesseractImageOcrExtractor implements IImageOcrExtractor {
  public async extractText(request: {
    readonly payload: Uint8Array;
    readonly language: string;
  }): Promise<string> {
    const tesseractRecord = await import("tesseract.js") as Readonly<Record<string, unknown>>;
    const recognize = tesseractRecord.recognize as (
      image: Uint8Array,
      lang?: string,
      options?: Readonly<Record<string, unknown>>,
    ) => Promise<unknown>;

    if (typeof recognize !== "function") {
      throw new Error("'tesseract.js' recognize API is unavailable.");
    }

    const result = await recognize(request.payload, request.language);
    const text = (result as {
      readonly data?: {
        readonly text?: string;
      };
    }).data?.text;

    return text?.trim() ?? "";
  }
}

export interface DocumentExtractionRequest {
  readonly source: ResolvedDataSource;
  readonly documentId?: string;
  readonly pdfConfig?: Partial<DocumentPdfIngestorConfig>;
  readonly ocrLanguage?: string;
}

function toUint8Array(payload: ResolvedDataSource["payload"]): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (typeof payload === "string") {
    return new TextEncoder().encode(payload);
  }
  throw new Error("Unsupported OCR payload. Expected string or Uint8Array.");
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function inferIsImage(source: ResolvedDataSource): boolean {
  const fileName = normalizeOptional(source.fileName)?.toLowerCase() ?? "";
  const contentType = normalizeOptional(source.contentType)?.toLowerCase() ?? "";
  return fileName.endsWith(".png")
    || fileName.endsWith(".jpg")
    || fileName.endsWith(".jpeg")
    || fileName.endsWith(".webp")
    || contentType.startsWith("image/");
}
export class DocumentPreparationExtractionService {
  private readonly pdfIngestor: DocumentPdfIngestorAsset;
  private readonly ocrExtractor: IImageOcrExtractor;

  constructor(input?: {
    readonly pdfIngestor?: DocumentPdfIngestorAsset;
    readonly ocrExtractor?: IImageOcrExtractor;
  }) {
    this.pdfIngestor = input?.pdfIngestor ?? new DocumentPdfIngestorAsset();
    this.ocrExtractor = input?.ocrExtractor ?? new TesseractImageOcrExtractor();
  }

  public async extractToTextItems(request: DocumentExtractionRequest): Promise<CanonicalTextItemsShape> {
    if (inferIsImage(request.source)) {
      const ocrText = await this.ocrExtractor.extractText({
        payload: toUint8Array(request.source.payload),
        language: request.ocrLanguage ?? "eng",
      });
      if (!ocrText.trim()) {
        return createCanonicalTextItemsShape({
          items: Object.freeze([]),
          metadata: {
            source: {
              fileName: request.source.fileName,
              contentType: request.source.contentType,
              format: "image-ocr",
            },
          },
        });
      }

      return createCanonicalTextItemsShape({
        items: Object.freeze([
          Object.freeze({
            itemId: `ocr-${request.documentId ?? request.source.fileName ?? "image"}-1`,
            sourceDocumentId: request.documentId ?? request.source.fileName ?? "image",
            text: ocrText,
            metadata: Object.freeze({
              extractionMode: "image-ocr",
              sourceReference: request.source.reference,
            }),
          }),
        ]),
        metadata: {
          source: {
            fileName: request.source.fileName,
            contentType: request.source.contentType,
            format: "image-ocr",
          },
        },
      });
    }

    const result = await this.pdfIngestor.execute({
      source: request.source,
      documentId: request.documentId,
      config: request.pdfConfig,
    });

    if (!result.ok) {
      throw new Error(result.diagnostics[0]?.message ?? "Document extraction failed.");
    }

    return result.output;
  }
}

export interface ImagePreparationExtractionRequest {
  readonly source: ResolvedDataSource;
  readonly imageId?: string;
  readonly ocrLanguage?: string;
  readonly enableOcr?: boolean;
  readonly extractionEmitShape?: typeof CanonicalDataShapeKinds.textItems | typeof CanonicalDataShapeKinds.imageMetadataRecords;
  readonly ingestorConfig?: Partial<ImageIngestorConfig>;
}

export class ImagePreparationExtractionService {
  private readonly imageIngestor: ImageIngestorAsset;
  private readonly ocrExtractor: IImageOcrExtractor;

  constructor(input?: {
    readonly imageIngestor?: ImageIngestorAsset;
    readonly ocrExtractor?: IImageOcrExtractor;
  }) {
    this.imageIngestor = input?.imageIngestor ?? new ImageIngestorAsset();
    this.ocrExtractor = input?.ocrExtractor ?? new TesseractImageOcrExtractor();
  }

  public async extract(
    request: ImagePreparationExtractionRequest,
  ): Promise<CanonicalTextItemsShape | CanonicalImageMetadataRecordsShape> {
    const result = await this.imageIngestor.execute({
      source: request.source,
      imageId: request.imageId,
      config: request.ingestorConfig,
    });

    if (!result.ok) {
      throw new Error(result.diagnostics[0]?.message ?? "Image extraction failed.");
    }

    if (!request.enableOcr) {
      return result.output;
    }

    const ocrText = await this.ocrExtractor.extractText({
      payload: toUint8Array(request.source.payload),
      language: request.ocrLanguage ?? "eng",
    });
    const emitShape = request.extractionEmitShape ?? CanonicalDataShapeKinds.textItems;

    if (emitShape === CanonicalDataShapeKinds.imageMetadataRecords) {
      const items = result.output.items.map((item) => Object.freeze({
        ...item,
        attributes: Object.freeze({
          ...(item.attributes ?? {}),
          ocrText,
          ocrTextLength: ocrText.length,
          ocrLanguage: request.ocrLanguage ?? "eng",
        }),
      }));

      return createCanonicalImageMetadataRecordsShape({
        items: Object.freeze(items),
        metadata: {
          ...result.output.metadata,
          attributes: {
            ...(result.output.metadata.attributes ?? {}),
            extractionMode: "image-ocr",
          },
        },
      });
    }

    if (!ocrText.trim()) {
      return createCanonicalTextItemsShape({
        items: Object.freeze([]),
        metadata: {
          source: {
            fileName: request.source.fileName,
            contentType: request.source.contentType,
            format: "image-ocr",
          },
        },
      });
    }

    return createCanonicalTextItemsShape({
      items: Object.freeze([
        Object.freeze({
          itemId: `ocr-${request.imageId ?? request.source.fileName ?? "image"}-1`,
          sourceDocumentId: request.imageId ?? request.source.fileName ?? "image",
          text: ocrText,
          metadata: Object.freeze({
            extractionMode: "image-ocr",
            sourceReference: request.source.reference,
          }),
        }),
      ]),
      metadata: {
        source: {
          fileName: request.source.fileName,
          contentType: request.source.contentType,
          format: "image-ocr",
        },
      },
    });
  }
}

export const SharpImageTransformationConfigSchema = z.object({
  resizeWidth: z.number().int().min(1).max(8192).optional(),
  resizeHeight: z.number().int().min(1).max(8192).optional(),
  grayscale: z.boolean().default(false),
  targetFormat: ImageTransformOutputFormatSchema.default("keep"),
});

export type SharpImageTransformationConfig = z.output<typeof SharpImageTransformationConfigSchema>;

export type SharpImageTransformationResult = ImageTransformationResult;

export class SharpImageTransformationService {
  private readonly transformer: IImageTransformer;

  constructor(input?: { readonly transformer?: IImageTransformer }) {
    this.transformer = input?.transformer ?? createDefaultMediaAdapterBundle().imageTransformer;
  }

  public async transform(
    payload: Uint8Array,
    configInput?: Partial<SharpImageTransformationConfig>,
  ): Promise<SharpImageTransformationResult> {
    const config = SharpImageTransformationConfigSchema.parse(configInput ?? {});
    return this.transformer.transform(payload, config);
  }
}

export const DocumentChunkingConfigSchema = z.object({
  strategy: z.enum([
    DocumentChunkingStrategyKinds.character,
    DocumentChunkingStrategyKinds.token,
  ]).default(DocumentChunkingStrategyKinds.character),
  chunkSize: z.number().int().min(1).max(16000).default(500),
  chunkOverlap: z.number().int().min(0).max(8000).default(50),
  tokenizerEncoding: z.string().trim().min(1).default("cl100k_base"),
});

export type DocumentChunkingConfig = z.output<typeof DocumentChunkingConfigSchema>;

function validateChunkParameters(config: DocumentChunkingConfig): void {
  if (config.chunkOverlap >= config.chunkSize) {
    throw new Error("Chunk overlap must be smaller than chunk size.");
  }
}

function chunkTextByCharacters(text: string, chunkSize: number, chunkOverlap: number): ReadonlyArray<string> {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end >= text.length) {
      break;
    }
    start = Math.max(0, end - chunkOverlap);
  }
  return Object.freeze(chunks.map((chunk) => chunk.trim()).filter((chunk) => chunk.length > 0));
}

function chunkTextByTokens(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  tokenizerEncoding: string,
): ReadonlyArray<string> {
  const encoding = getTokenizer(tokenizerEncoding);
  const tokens = encoding.encode(text);
  if (tokens.length === 0) {
    return Object.freeze([]);
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < tokens.length) {
    const end = Math.min(tokens.length, start + chunkSize);
    const slice = tokens.slice(start, end);
    const textChunk = encoding.decode(slice).trim();
    if (textChunk.length > 0) {
      chunks.push(textChunk);
    }

    if (end >= tokens.length) {
      break;
    }
    start = Math.max(0, end - chunkOverlap);
  }

  return Object.freeze(chunks);
}

export function chunkDocumentTextItems(
  input: CanonicalTextItemsShape,
  configInput?: Partial<DocumentChunkingConfig>,
): CanonicalTextItemsShape {
  const config = DocumentChunkingConfigSchema.parse(configInput ?? {});
  validateChunkParameters(config);

  const chunkedItems = input.items.flatMap((item, itemIndex) => {
    const chunks = config.strategy === DocumentChunkingStrategyKinds.character
      ? chunkTextByCharacters(item.text, config.chunkSize, config.chunkOverlap)
      : chunkTextByTokens(item.text, config.chunkSize, config.chunkOverlap, config.tokenizerEncoding);

    return chunks.map((chunk, chunkIndex) => Object.freeze({
      itemId: `${item.itemId}:chunk:${chunkIndex + 1}`,
      sourceDocumentId: item.sourceDocumentId,
      text: chunk,
      metadata: Object.freeze({
        ...(item.metadata ?? {}),
        chunkIndex,
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
        chunkingStrategy: config.strategy,
        sourceItemIndex: itemIndex,
      }),
    }));
  });

  return createCanonicalTextItemsShape({
    items: Object.freeze(chunkedItems),
    metadata: {
      ...input.metadata,
      attributes: {
        ...(input.metadata.attributes ?? {}),
        chunkingStrategy: config.strategy,
        chunkCount: chunkedItems.length,
      },
    },
  });
}

