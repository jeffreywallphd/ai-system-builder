import { z } from "zod";
import type { CanonicalRecordValue } from "./CanonicalDataShapes";

export const EnrichmentStrategyKinds = Object.freeze({
  derived: "derived",
  lookup: "lookup",
  metadataAugmentation: "metadata-augmentation",
} as const);

export type EnrichmentStrategyKind =
  typeof EnrichmentStrategyKinds[keyof typeof EnrichmentStrategyKinds];

export const EnrichmentLookupJoinTypeKinds = Object.freeze({
  left: "left",
  inner: "inner",
} as const);

export type EnrichmentLookupJoinTypeKind =
  typeof EnrichmentLookupJoinTypeKinds[keyof typeof EnrichmentLookupJoinTypeKinds];

export interface EnrichmentDerivedFieldSpec {
  readonly targetField: string;
  readonly expression: string;
  readonly sourceFields?: ReadonlyArray<string>;
  readonly fallbackValue?: CanonicalRecordValue;
}

export interface EnrichmentLookupConfig {
  readonly sourceAssetId?: string;
  readonly sourceReference?: string;
  readonly inputKey: string;
  readonly lookupKey: string;
  readonly joinType: EnrichmentLookupJoinTypeKind;
  readonly selectedFields?: ReadonlyArray<string>;
  readonly preserveUnmatched: boolean;
}

export interface EnrichmentMetadataAugmentationConfig {
  readonly includeImageMetadata: boolean;
  readonly includeDocumentStats: boolean;
  readonly includeProfiling: boolean;
  readonly staticFields?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface EnrichmentStageConfig {
  readonly strategy: EnrichmentStrategyKind;
  readonly outputFieldPrefix: string;
  readonly previewSampleSize: number;
  readonly derivedFields?: ReadonlyArray<EnrichmentDerivedFieldSpec>;
  readonly lookup?: EnrichmentLookupConfig;
  readonly metadataAugmentation?: EnrichmentMetadataAugmentationConfig;
}

const NonEmptyStringSchema = z.string().trim().min(1);

const DerivedFieldSpecSchema = z.object({
  targetField: NonEmptyStringSchema,
  expression: NonEmptyStringSchema,
  sourceFields: z.array(NonEmptyStringSchema).optional(),
  fallbackValue: z.any().optional(),
});

const LookupConfigSchema = z.object({
  sourceAssetId: NonEmptyStringSchema.optional(),
  sourceReference: NonEmptyStringSchema.optional(),
  inputKey: NonEmptyStringSchema.default("id"),
  lookupKey: NonEmptyStringSchema.default("id"),
  joinType: z.nativeEnum(EnrichmentLookupJoinTypeKinds).default(EnrichmentLookupJoinTypeKinds.left),
  selectedFields: z.array(NonEmptyStringSchema).optional(),
  preserveUnmatched: z.boolean().default(true),
});

const MetadataAugmentationConfigSchema = z.object({
  includeImageMetadata: z.boolean().default(true),
  includeDocumentStats: z.boolean().default(true),
  includeProfiling: z.boolean().default(true),
  staticFields: z.record(z.any()).optional(),
});

export const EnrichmentStageConfigSchema = z.object({
  strategy: z.nativeEnum(EnrichmentStrategyKinds).default(EnrichmentStrategyKinds.metadataAugmentation),
  outputFieldPrefix: NonEmptyStringSchema.default("enriched"),
  previewSampleSize: z.number().int().min(1).max(1000).default(25),
  derivedFields: z.array(DerivedFieldSpecSchema).optional(),
  lookup: LookupConfigSchema.optional(),
  metadataAugmentation: MetadataAugmentationConfigSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.strategy === EnrichmentStrategyKinds.derived && (!value.derivedFields || value.derivedFields.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["derivedFields"],
      message: "Derived enrichment strategy requires at least one derived field spec.",
    });
  }

  if (value.strategy === EnrichmentStrategyKinds.lookup && !value.lookup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lookup"],
      message: "Lookup enrichment strategy requires lookup configuration.",
    });
  }

  if (value.strategy === EnrichmentStrategyKinds.metadataAugmentation && !value.metadataAugmentation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadataAugmentation"],
      message: "Metadata augmentation strategy requires metadata configuration.",
    });
  }
});

function normalizeStringArray(value: CanonicalRecordValue | undefined): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? Object.freeze(entries) : undefined;
}

function normalizeRecord(value: CanonicalRecordValue | undefined): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze({ ...(value as Record<string, CanonicalRecordValue>) });
}

export function createEnrichmentStageConfig(
  input?: Partial<EnrichmentStageConfig>,
): EnrichmentStageConfig {
  const parsed = EnrichmentStageConfigSchema.parse(input ?? {});
  return Object.freeze(parsed);
}

export function parseEnrichmentStageConfigFromStageOptions(
  options: Readonly<Record<string, CanonicalRecordValue>>,
): EnrichmentStageConfig {
  const raw = {
    strategy: typeof options.enrichmentStrategy === "string"
      ? options.enrichmentStrategy
      : undefined,
    outputFieldPrefix: typeof options.enrichedFieldPrefix === "string"
      ? options.enrichedFieldPrefix
      : undefined,
    previewSampleSize: typeof options.previewSampleSize === "number"
      ? options.previewSampleSize
      : undefined,
    derivedFields: Array.isArray(options.derivedFields)
      ? options.derivedFields
      : undefined,
    lookup: options.lookupSourceAssetId || options.lookupSourceReference || options.lookupInputKey || options.lookupLookupKey
      ? {
        sourceAssetId: typeof options.lookupSourceAssetId === "string" ? options.lookupSourceAssetId : undefined,
        sourceReference: typeof options.lookupSourceReference === "string" ? options.lookupSourceReference : undefined,
        inputKey: typeof options.lookupInputKey === "string" ? options.lookupInputKey : undefined,
        lookupKey: typeof options.lookupLookupKey === "string" ? options.lookupLookupKey : undefined,
        joinType: typeof options.lookupJoinType === "string" ? options.lookupJoinType : undefined,
        selectedFields: normalizeStringArray(options.lookupSelectedFields),
        preserveUnmatched: typeof options.lookupPreserveUnmatched === "boolean"
          ? options.lookupPreserveUnmatched
          : undefined,
      }
      : undefined,
    metadataAugmentation: options.metadataIncludeImageMetadata !== undefined
      || options.metadataIncludeDocumentStats !== undefined
      || options.metadataIncludeProfiling !== undefined
      || options.metadataStaticFields !== undefined
      ? {
        includeImageMetadata: typeof options.metadataIncludeImageMetadata === "boolean"
          ? options.metadataIncludeImageMetadata
          : undefined,
        includeDocumentStats: typeof options.metadataIncludeDocumentStats === "boolean"
          ? options.metadataIncludeDocumentStats
          : undefined,
        includeProfiling: typeof options.metadataIncludeProfiling === "boolean"
          ? options.metadataIncludeProfiling
          : undefined,
        staticFields: normalizeRecord(options.metadataStaticFields),
      }
      : undefined,
  };

  const strategy = raw.strategy ?? EnrichmentStrategyKinds.metadataAugmentation;
  const withStrategyDefaults = {
    ...raw,
    derivedFields: raw.derivedFields ?? (
      strategy === EnrichmentStrategyKinds.derived
        ? Object.freeze([
          Object.freeze({
            targetField: "derived.flag",
            expression: "value != null",
            sourceFields: Object.freeze(["value"]),
          }),
        ])
        : undefined
    ),
    lookup: raw.lookup ?? (
      strategy === EnrichmentStrategyKinds.lookup
        ? Object.freeze({
          inputKey: "id",
          lookupKey: "id",
          joinType: EnrichmentLookupJoinTypeKinds.left,
          preserveUnmatched: true,
        })
        : undefined
    ),
    metadataAugmentation: raw.metadataAugmentation ?? (
      strategy === EnrichmentStrategyKinds.metadataAugmentation
        ? Object.freeze({
          includeImageMetadata: true,
          includeDocumentStats: true,
          includeProfiling: true,
        })
        : undefined
    ),
  };

  return createEnrichmentStageConfig(withStrategyDefaults);
}

export function toEnrichmentStageOptions(
  config: EnrichmentStageConfig,
): Readonly<Record<string, CanonicalRecordValue>> {
  const options: Record<string, CanonicalRecordValue | undefined> = {
    enrichmentStrategy: config.strategy,
    enrichedFieldPrefix: config.outputFieldPrefix,
    previewSampleSize: config.previewSampleSize,
    derivedFields: config.derivedFields ?? Object.freeze([]),
    lookupSourceAssetId: config.lookup?.sourceAssetId,
    lookupSourceReference: config.lookup?.sourceReference,
    lookupInputKey: config.lookup?.inputKey,
    lookupLookupKey: config.lookup?.lookupKey,
    lookupJoinType: config.lookup?.joinType,
    lookupSelectedFields: config.lookup?.selectedFields ?? Object.freeze([]),
    lookupPreserveUnmatched: config.lookup?.preserveUnmatched ?? true,
    metadataIncludeImageMetadata: config.metadataAugmentation?.includeImageMetadata ?? true,
    metadataIncludeDocumentStats: config.metadataAugmentation?.includeDocumentStats ?? true,
    metadataIncludeProfiling: config.metadataAugmentation?.includeProfiling ?? true,
    metadataStaticFields: config.metadataAugmentation?.staticFields ?? Object.freeze({}),
  };
  const definedEntries = Object.entries(options)
    .filter((entry): entry is [string, CanonicalRecordValue] => entry[1] !== undefined);
  return Object.freeze(Object.fromEntries(definedEntries));
}
