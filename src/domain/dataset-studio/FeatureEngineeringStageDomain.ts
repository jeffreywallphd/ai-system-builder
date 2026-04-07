import { z } from "zod";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "./CanonicalDataShapes";

export const FeatureEngineeringStrategyKinds = Object.freeze({
  structured: "structured",
  textDerived: "text-derived",
  imageMetadata: "image-metadata",
  mixed: "mixed",
} as const);

export type FeatureEngineeringStrategy =
  typeof FeatureEngineeringStrategyKinds[keyof typeof FeatureEngineeringStrategyKinds];

export const FeatureEngineeringOperationKinds = Object.freeze({
  derivedNumeric: "derived-numeric",
  categoricalFlag: "categorical-flag",
  textSummary: "text-summary",
  bucketization: "bucketization",
  projection: "projection",
} as const);

export type FeatureEngineeringOperationKind =
  typeof FeatureEngineeringOperationKinds[keyof typeof FeatureEngineeringOperationKinds];

export const DerivedNumericMethodKinds = Object.freeze({
  ratio: "ratio",
  difference: "difference",
  arithmeticCombination: "arithmetic-combination",
} as const);

export type DerivedNumericMethodKind =
  typeof DerivedNumericMethodKinds[keyof typeof DerivedNumericMethodKinds];

export const CategoricalFlagModeKinds = Object.freeze({
  threshold: "threshold",
  presence: "presence",
  mappedCategory: "mapped-category",
} as const);

export type CategoricalFlagModeKind =
  typeof CategoricalFlagModeKinds[keyof typeof CategoricalFlagModeKinds];

export const TextSummaryMetricKinds = Object.freeze({
  textLength: "text-length",
  tokenCount: "token-count",
  chunkCount: "chunk-count",
} as const);

export type TextSummaryMetricKind =
  typeof TextSummaryMetricKinds[keyof typeof TextSummaryMetricKinds];

export interface FeatureEngineeringDerivedNumericOperation {
  readonly kind: "derived-numeric";
  readonly operationId: string;
  readonly targetField: string;
  readonly method: DerivedNumericMethodKind;
  readonly sourceFields: ReadonlyArray<string>;
  readonly expression?: string;
  readonly fallbackValue?: number;
}

export interface FeatureEngineeringCategoricalFlagOperation {
  readonly kind: "categorical-flag";
  readonly operationId: string;
  readonly targetField: string;
  readonly sourceField: string;
  readonly mode: CategoricalFlagModeKind;
  readonly threshold?: number;
  readonly comparator?: "gte" | "gt" | "lte" | "lt" | "eq" | "neq";
  readonly presenceValues?: ReadonlyArray<CanonicalRecordValue>;
  readonly categoryMap?: Readonly<Record<string, ReadonlyArray<CanonicalRecordValue>>>;
  readonly defaultValue?: string | boolean;
}

export interface FeatureEngineeringTextSummaryOperation {
  readonly kind: "text-summary";
  readonly operationId: string;
  readonly targetField: string;
  readonly sourceField: string;
  readonly metric: TextSummaryMetricKind;
  readonly tokenCountField?: string;
  readonly chunkCountField?: string;
  readonly fallbackValue?: number;
}

export interface FeatureEngineeringBucketizationRange {
  readonly bucketId: string;
  readonly label?: string;
  readonly min?: number;
  readonly max?: number;
  readonly includeMin?: boolean;
  readonly includeMax?: boolean;
}

export interface FeatureEngineeringBucketizationOperation {
  readonly kind: "bucketization";
  readonly operationId: string;
  readonly targetField: string;
  readonly sourceField: string;
  readonly buckets: ReadonlyArray<FeatureEngineeringBucketizationRange>;
  readonly defaultBucketId?: string;
}

export interface FeatureEngineeringProjectionOperation {
  readonly kind: "projection";
  readonly operationId: string;
  readonly selectedFields: ReadonlyArray<string>;
  readonly includeEngineeredFields: boolean;
}

export type FeatureEngineeringOperation =
  | FeatureEngineeringDerivedNumericOperation
  | FeatureEngineeringCategoricalFlagOperation
  | FeatureEngineeringTextSummaryOperation
  | FeatureEngineeringBucketizationOperation
  | FeatureEngineeringProjectionOperation;

export interface FeatureEngineeringStageConfig {
  readonly strategy: FeatureEngineeringStrategy;
  readonly operations: ReadonlyArray<FeatureEngineeringOperation>;
  readonly outputFieldPrefix: string;
  readonly preserveSourceFields: boolean;
  readonly enforceTypeValidation: boolean;
  readonly allowedInputShapes: ReadonlyArray<CanonicalDataShapeKind>;
}

const NonEmptyStringSchema = z.string().trim().min(1);

const DerivedNumericOperationSchema = z.object({
  kind: z.literal(FeatureEngineeringOperationKinds.derivedNumeric),
  operationId: NonEmptyStringSchema,
  targetField: NonEmptyStringSchema,
  method: z.nativeEnum(DerivedNumericMethodKinds),
  sourceFields: z.array(NonEmptyStringSchema).min(2),
  expression: NonEmptyStringSchema.optional(),
  fallbackValue: z.number().optional(),
}).superRefine((value, ctx) => {
  if (
    value.method === DerivedNumericMethodKinds.ratio
    && value.sourceFields.length !== 2
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceFields"],
      message: "Ratio operations require exactly two source fields.",
    });
  }
  if (
    value.method === DerivedNumericMethodKinds.difference
    && value.sourceFields.length !== 2
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceFields"],
      message: "Difference operations require exactly two source fields.",
    });
  }
  if (
    value.method === DerivedNumericMethodKinds.arithmeticCombination
    && !value.expression
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expression"],
      message: "Arithmetic combination operations require a non-empty expression.",
    });
  }
});

const CategoricalFlagOperationSchema = z.object({
  kind: z.literal(FeatureEngineeringOperationKinds.categoricalFlag),
  operationId: NonEmptyStringSchema,
  targetField: NonEmptyStringSchema,
  sourceField: NonEmptyStringSchema,
  mode: z.nativeEnum(CategoricalFlagModeKinds),
  threshold: z.number().optional(),
  comparator: z.enum(["gte", "gt", "lte", "lt", "eq", "neq"]).optional(),
  presenceValues: z.array(z.any()).optional(),
  categoryMap: z.record(z.array(z.any())).optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
}).superRefine((value, ctx) => {
  if (value.mode === CategoricalFlagModeKinds.threshold && value.threshold === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["threshold"],
      message: "Threshold categorical flags require a numeric threshold value.",
    });
  }
  if (
    value.mode === CategoricalFlagModeKinds.presence
    && (!value.presenceValues || value.presenceValues.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presenceValues"],
      message: "Presence categorical flags require at least one presence value.",
    });
  }
  if (
    value.mode === CategoricalFlagModeKinds.mappedCategory
    && (!value.categoryMap || Object.keys(value.categoryMap).length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryMap"],
      message: "Mapped-category flags require a non-empty category map.",
    });
  }
});

const TextSummaryOperationSchema = z.object({
  kind: z.literal(FeatureEngineeringOperationKinds.textSummary),
  operationId: NonEmptyStringSchema,
  targetField: NonEmptyStringSchema,
  sourceField: NonEmptyStringSchema,
  metric: z.nativeEnum(TextSummaryMetricKinds),
  tokenCountField: NonEmptyStringSchema.optional(),
  chunkCountField: NonEmptyStringSchema.optional(),
  fallbackValue: z.number().optional(),
}).superRefine((value, ctx) => {
  if (value.metric === TextSummaryMetricKinds.tokenCount && !value.tokenCountField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tokenCountField"],
      message: "Token-count text features require tokenCountField when available.",
    });
  }
  if (value.metric === TextSummaryMetricKinds.chunkCount && !value.chunkCountField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chunkCountField"],
      message: "Chunk-count text features require chunkCountField when applicable.",
    });
  }
});

const BucketizationRangeSchema = z.object({
  bucketId: NonEmptyStringSchema,
  label: NonEmptyStringSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  includeMin: z.boolean().default(true),
  includeMax: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.min === undefined && value.max === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["min"],
      message: "Bucket range must define at least one bound (min or max).",
    });
  }
  if (
    value.min !== undefined
    && value.max !== undefined
    && value.min > value.max
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["max"],
      message: "Bucket range max must be greater than or equal to min.",
    });
  }
});

const BucketizationOperationSchema = z.object({
  kind: z.literal(FeatureEngineeringOperationKinds.bucketization),
  operationId: NonEmptyStringSchema,
  targetField: NonEmptyStringSchema,
  sourceField: NonEmptyStringSchema,
  buckets: z.array(BucketizationRangeSchema).min(1),
  defaultBucketId: NonEmptyStringSchema.optional(),
});

const ProjectionOperationSchema = z.object({
  kind: z.literal(FeatureEngineeringOperationKinds.projection),
  operationId: NonEmptyStringSchema,
  selectedFields: z.array(NonEmptyStringSchema).min(1),
  includeEngineeredFields: z.boolean().default(true),
});

export const FeatureEngineeringOperationSchema = z.discriminatedUnion("kind", [
  DerivedNumericOperationSchema,
  CategoricalFlagOperationSchema,
  TextSummaryOperationSchema,
  BucketizationOperationSchema,
  ProjectionOperationSchema,
]);

export const FeatureEngineeringStageConfigSchema = z.object({
  strategy: z.nativeEnum(FeatureEngineeringStrategyKinds).default(FeatureEngineeringStrategyKinds.structured),
  operations: z.array(FeatureEngineeringOperationSchema).default([]),
  outputFieldPrefix: NonEmptyStringSchema.default("feature"),
  preserveSourceFields: z.boolean().default(true),
  enforceTypeValidation: z.boolean().default(true),
  allowedInputShapes: z.array(z.nativeEnum(CanonicalDataShapeKinds))
    .min(1)
    .default([
      CanonicalDataShapeKinds.records,
      CanonicalDataShapeKinds.table,
      CanonicalDataShapeKinds.textItems,
      CanonicalDataShapeKinds.imageMetadataRecords,
    ]),
}).superRefine((value, ctx) => {
  const requiresTextOperations = value.operations.some(
    (operation) => operation.kind === FeatureEngineeringOperationKinds.textSummary,
  );
  if (
    requiresTextOperations
    && !value.allowedInputShapes.includes(CanonicalDataShapeKinds.textItems)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedInputShapes"],
      message: "Text summary operations require text-items in allowed input shapes.",
    });
  }

  if (
    value.strategy === FeatureEngineeringStrategyKinds.imageMetadata
    && value.allowedInputShapes.some((shape) => (
      shape !== CanonicalDataShapeKinds.imageMetadataRecords
      && shape !== CanonicalDataShapeKinds.textItems
    ))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowedInputShapes"],
      message: "Image-metadata strategy supports only image-metadata-records and OCR-derived text-items.",
    });
  }
});

function normalizeStringArray(value: CanonicalRecordValue | undefined): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

export function createFeatureEngineeringStageConfig(
  input?: Partial<FeatureEngineeringStageConfig>,
): FeatureEngineeringStageConfig {
  const parsed = FeatureEngineeringStageConfigSchema.parse(input ?? {});
  return Object.freeze(parsed);
}

export function parseFeatureEngineeringStageConfigFromStageOptions(
  options: Readonly<Record<string, CanonicalRecordValue>>,
): FeatureEngineeringStageConfig {
  return createFeatureEngineeringStageConfig({
    strategy: typeof options.featureStrategy === "string"
      ? options.featureStrategy as FeatureEngineeringStrategy
      : undefined,
    operations: Array.isArray(options.featureOperations)
      ? options.featureOperations as ReadonlyArray<FeatureEngineeringOperation>
      : undefined,
    outputFieldPrefix: typeof options.featureOutputFieldPrefix === "string"
      ? options.featureOutputFieldPrefix
      : undefined,
    preserveSourceFields: typeof options.featurePreserveSourceFields === "boolean"
      ? options.featurePreserveSourceFields
      : undefined,
    enforceTypeValidation: typeof options.featureEnforceTypeValidation === "boolean"
      ? options.featureEnforceTypeValidation
      : undefined,
    allowedInputShapes: normalizeStringArray(options.featureAllowedInputShapes) as ReadonlyArray<CanonicalDataShapeKind> | undefined,
  });
}

export function toFeatureEngineeringStageOptions(
  config: FeatureEngineeringStageConfig,
): Readonly<Record<string, CanonicalRecordValue>> {
  const options: Record<string, CanonicalRecordValue | undefined> = {
    featureStrategy: config.strategy,
    featureOperations: config.operations as unknown as CanonicalRecordValue,
    featureOutputFieldPrefix: config.outputFieldPrefix,
    featurePreserveSourceFields: config.preserveSourceFields,
    featureEnforceTypeValidation: config.enforceTypeValidation,
    featureAllowedInputShapes: config.allowedInputShapes as unknown as CanonicalRecordValue,
  };

  return Object.freeze(
    Object.fromEntries(
      Object.entries(options).filter((entry): entry is [string, CanonicalRecordValue] => entry[1] !== undefined),
    ),
  );
}

