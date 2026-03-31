import { getEncoding, type TiktokenEncoding } from "js-tiktoken";
import { z } from "zod";
import {
  createCanonicalTextItemsShape,
  isCanonicalDataShape,
  CanonicalDataShapeKinds,
  type CanonicalDataShape,
  type CanonicalRecordValue,
  type CanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import type { PipelineDefinition } from "../../domain/dataset-studio/PipelineDefinitionDomain";
import { validatePipelineDefinition } from "../../domain/dataset-studio/PipelineDefinitionDomain";
import {
  createPipelineStageInstance,
  PipelineStageConfigModes,
  PipelineStageIds,
  type PipelineStageId,
  type PipelineStageInstance,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  DatasetIngestionStageAssetIds,
  DatasetTransformationStageAssetIds,
} from "../../domain/dataset-studio/StagePipelineDomain";
import type { ResolvedDataSource } from "./DataConverterContracts";
import {
  DocumentPdfIngestorAsset,
  type DocumentPdfIngestorConfig,
} from "./DocumentPdfIngestorAsset";
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
  PipelineStageIds.Aggregation,
] as const);

const DefaultDocumentStageOrder = Object.freeze([
  PipelineStageIds.Extraction,
  PipelineStageIds.Normalization,
  PipelineStageIds.Chunking,
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
  if (aggregationIndex >= 0) {
    if (aggregationIndex <= cleaningIndex) {
      throw new Error("Tabular cleaning pipeline requires Aggregation to run after Cleaning.");
    }
    if (transformationIndex >= 0 && aggregationIndex <= transformationIndex) {
      throw new Error("Tabular cleaning pipeline requires Aggregation to run after Transformation.");
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

function mergeConfig(
  stageId: PipelineStageId,
  defaults: Readonly<Record<string, CanonicalRecordValue>>,
  overrides: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>> | undefined,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({
    ...defaults,
    ...(overrides?.[stageId] ?? {}),
  });
}
function toPipelineDefinition(input: {
  readonly stageOrder: ReadonlyArray<PipelineStageId>;
  readonly tabularShape?: z.output<typeof TabularShapeSchema>;
  readonly stageConfigOverrides?: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>;
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
      defaultOptions.labelingMode = "placeholder";
      defaultOptions.emitRecordLevelTags = true;
    }
    if (stageId === PipelineStageIds.Enrichment) {
      defaultOptions.enrichmentMode = "optional-hook";
      defaultOptions.joinKey = "id";
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
        id: "document-labeling",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.dataClassification,
            version: "1.0.0",
            role: "labeling-placeholder",
            configMapping: Object.freeze([
              { stageConfigKey: "labelingMode", assetConfigKey: "labelingMode", defaultValue: "placeholder" },
            ]),
          }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    stageId: PipelineStageIds.Enrichment,
    inspectable: true,
    groups: Object.freeze([
      Object.freeze({
        id: "document-enrichment",
        executionOrder: 1,
        executionMode: "sequential",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.unified,
            version: "1.0.0",
            role: "enrichment-hook",
            configMapping: Object.freeze([
              { stageConfigKey: "enrichmentMode", assetConfigKey: "enrichmentMode", defaultValue: "optional-hook" },
              { stageConfigKey: "joinKey", assetConfigKey: "joinKey", defaultValue: "id" },
            ]),
          }),
          Object.freeze({
            assetId: DatasetTransformationStageAssetIds.fieldMapping,
            version: "1.0.0",
            role: "enrichment-transform",
            configMapping: Object.freeze([]),
          }),
        ]),
      }),
    ]),
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
