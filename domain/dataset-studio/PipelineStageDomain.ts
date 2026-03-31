import { z } from "zod";
import {
  CanonicalDataShapeKinds,
  type CanonicalDataShapeKind,
  type CanonicalRecordValue,
} from "./CanonicalDataShapes";

export const PipelineStageIds = Object.freeze({
  SourceSelection: "SourceSelection",
  UnifiedIngestion: "UnifiedIngestion",
  StorageRaw: "StorageRaw",
  Profiling: "Profiling",
  Classification: "Classification",
  Normalization: "Normalization",
  Cleaning: "Cleaning",
  Transformation: "Transformation",
  Enrichment: "Enrichment",
  FeatureEngineering: "FeatureEngineering",
  Extraction: "Extraction",
  Chunking: "Chunking",
  Aggregation: "Aggregation",
  Labeling: "Labeling",
  StoragePrepared: "StoragePrepared",
} as const);

export type PipelineStageId = typeof PipelineStageIds[keyof typeof PipelineStageIds];

export const PipelineStageCategories = Object.freeze({
  selection: "selection",
  ingestion: "ingestion",
  storage: "storage",
  profiling: "profiling",
  classification: "classification",
  normalization: "normalization",
  cleaning: "cleaning",
  transformation: "transformation",
  enrichment: "enrichment",
  featureEngineering: "feature-engineering",
  extraction: "extraction",
  chunking: "chunking",
  aggregation: "aggregation",
  labeling: "labeling",
} as const);

export type PipelineStageCategory =
  typeof PipelineStageCategories[keyof typeof PipelineStageCategories];

export const PipelineStageConfigModes = Object.freeze({
  simple: "simple",
  advanced: "advanced",
} as const);

export type PipelineStageConfigMode =
  typeof PipelineStageConfigModes[keyof typeof PipelineStageConfigModes];

export interface PipelineStageOrderingConstraints {
  readonly before?: ReadonlyArray<PipelineStageId>;
  readonly after?: ReadonlyArray<PipelineStageId>;
}

export interface PipelineStageMetadata {
  readonly tags: ReadonlyArray<string>;
  readonly inspectable: boolean;
  readonly previewReference?: string;
  readonly sourceReference?: string;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface PipelineStageConfig {
  readonly mode: PipelineStageConfigMode;
  readonly declaredInputType?: CanonicalDataShapeKind;
  readonly expectedOutputType?: CanonicalDataShapeKind;
  readonly options: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface PipelineStageDefinition {
  readonly id: PipelineStageId;
  readonly displayName: string;
  readonly description: string;
  readonly category: PipelineStageCategory;
  readonly allowedInputTypes: ReadonlyArray<CanonicalDataShapeKind>;
  readonly producedOutputTypes: ReadonlyArray<CanonicalDataShapeKind>;
  readonly isOptional: boolean;
  readonly defaultEnabled: boolean;
  readonly orderingConstraints: PipelineStageOrderingConstraints;
  readonly supportsPreview: boolean;
}

export interface PipelineStageInstance {
  readonly stageId: PipelineStageId;
  readonly enabled: boolean;
  readonly config: PipelineStageConfig;
  readonly metadata: PipelineStageMetadata;
}

const StageIdSchema = z.nativeEnum(PipelineStageIds);
const StageCategorySchema = z.nativeEnum(PipelineStageCategories);
const ShapeKindSchema = z.nativeEnum(CanonicalDataShapeKinds);
const StageConfigModeSchema = z.nativeEnum(PipelineStageConfigModes);

const OrderingConstraintsSchema = z.object({
  before: z.array(StageIdSchema).optional(),
  after: z.array(StageIdSchema).optional(),
});

export const PipelineStageDefinitionSchema = z.object({
  id: StageIdSchema,
  displayName: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: StageCategorySchema,
  allowedInputTypes: z.array(ShapeKindSchema).min(1),
  producedOutputTypes: z.array(ShapeKindSchema).min(1),
  isOptional: z.boolean(),
  defaultEnabled: z.boolean(),
  orderingConstraints: OrderingConstraintsSchema,
  supportsPreview: z.boolean(),
});

export const PipelineStageMetadataSchema = z.object({
  tags: z.array(z.string().trim().min(1)),
  inspectable: z.boolean(),
  previewReference: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  attributes: z.record(z.any()).optional(),
});

export const PipelineStageConfigSchema = z.object({
  mode: StageConfigModeSchema,
  declaredInputType: ShapeKindSchema.optional(),
  expectedOutputType: ShapeKindSchema.optional(),
  options: z.record(z.any()),
});

export const PipelineStageInstanceSchema = z.object({
  stageId: StageIdSchema,
  enabled: z.boolean(),
  config: PipelineStageConfigSchema,
  metadata: PipelineStageMetadataSchema,
});

function dedupeValues<T extends string>(values?: ReadonlyArray<T>): ReadonlyArray<T> {
  if (!values || values.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze([...new Set(values)]);
}

function normalizeOrderingConstraints(
  stageId: PipelineStageId,
  constraints: PipelineStageOrderingConstraints,
): PipelineStageOrderingConstraints {
  const before = dedupeValues(constraints.before);
  const after = dedupeValues(constraints.after);

  if (before.includes(stageId) || after.includes(stageId)) {
    throw new Error(`Stage '${stageId}' cannot declare ordering constraints against itself.`);
  }

  const overlap = before.filter((candidate) => after.includes(candidate));
  if (overlap.length > 0) {
    throw new Error(`Stage '${stageId}' cannot declare the same stage in both before/after constraints.`);
  }

  return Object.freeze({
    before,
    after,
  });
}

export function createPipelineStageDefinition(
  input: PipelineStageDefinition,
): PipelineStageDefinition {
  const parsed = PipelineStageDefinitionSchema.parse(input);
  if (!parsed.isOptional && !parsed.defaultEnabled) {
    throw new Error(`Required stage '${parsed.id}' must be enabled by default.`);
  }

  return Object.freeze({
    ...parsed,
    orderingConstraints: normalizeOrderingConstraints(parsed.id, parsed.orderingConstraints),
    allowedInputTypes: dedupeValues(parsed.allowedInputTypes),
    producedOutputTypes: dedupeValues(parsed.producedOutputTypes),
  });
}

export function createPipelineStageInstance(input: {
  readonly definition: PipelineStageDefinition;
  readonly enabled?: boolean;
  readonly config?: Partial<PipelineStageConfig>;
  readonly metadata?: Partial<PipelineStageMetadata>;
}): PipelineStageInstance {
  const definition = createPipelineStageDefinition(input.definition);
  const candidate: PipelineStageInstance = {
    stageId: definition.id,
    enabled: input.enabled ?? definition.defaultEnabled,
    config: {
      mode: input.config?.mode ?? PipelineStageConfigModes.simple,
      declaredInputType: input.config?.declaredInputType,
      expectedOutputType: input.config?.expectedOutputType,
      options: input.config?.options ?? Object.freeze({}),
    },
    metadata: {
      tags: input.metadata?.tags ?? Object.freeze([]),
      inspectable: input.metadata?.inspectable ?? true,
      previewReference: input.metadata?.previewReference,
      sourceReference: input.metadata?.sourceReference,
      attributes: input.metadata?.attributes,
    },
  };

  const parsed = PipelineStageInstanceSchema.parse(candidate);
  if (!definition.isOptional && !parsed.enabled) {
    throw new Error(`Required stage '${definition.id}' cannot be disabled.`);
  }

  const declaredInputType = parsed.config.declaredInputType;
  if (declaredInputType && !definition.allowedInputTypes.includes(declaredInputType)) {
    throw new Error(
      `Stage '${definition.id}' does not accept declared input type '${declaredInputType}'.`,
    );
  }

  const expectedOutputType = parsed.config.expectedOutputType;
  if (expectedOutputType && !definition.producedOutputTypes.includes(expectedOutputType)) {
    throw new Error(
      `Stage '${definition.id}' does not produce expected output type '${expectedOutputType}'.`,
    );
  }

  return Object.freeze(parsed);
}

export function isCompatibleStageDataShape(
  definition: PipelineStageDefinition,
  inputType: CanonicalDataShapeKind,
): boolean {
  return definition.allowedInputTypes.includes(inputType);
}