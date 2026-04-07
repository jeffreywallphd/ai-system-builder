import { z } from "zod";

export const IngestionContractVersion = "1.0.0";

export const IngestionExecutionModes = Object.freeze({
  execute: "execute",
  preview: "preview",
} as const);

export type IngestionExecutionMode = typeof IngestionExecutionModes[keyof typeof IngestionExecutionModes];

export const IngestionExecutionStatuses = Object.freeze({
  succeeded: "succeeded",
  failed: "failed",
  partial: "partial",
} as const);

export type IngestionExecutionStatus = typeof IngestionExecutionStatuses[keyof typeof IngestionExecutionStatuses];

export const IngestionIssueSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
} as const);

export type IngestionIssueSeverity = typeof IngestionIssueSeverities[keyof typeof IngestionIssueSeverities];

export const IngestionIssueCategories = Object.freeze({
  invalidConfiguration: "invalid-configuration",
  unsupportedSourceType: "unsupported-source-type",
  sourceNotFound: "source-not-found",
  unreadableSource: "unreadable-source",
  parseExtractionFailure: "parse-extraction-failure",
  normalizationFailure: "normalization-failure",
  previewFailure: "preview-failure",
  batchPartialFailure: "batch-partial-failure",
  unknownInternalFailure: "unknown-internal-failure",
} as const);

export type IngestionIssueCategory = typeof IngestionIssueCategories[keyof typeof IngestionIssueCategories];

export const IngestionIssueRecoverabilities = Object.freeze({
  none: "none",
  retryable: "retryable",
  fixConfig: "fix-config",
  fixSource: "fix-source",
  partial: "partial",
} as const);

export type IngestionIssueRecoverability =
  typeof IngestionIssueRecoverabilities[keyof typeof IngestionIssueRecoverabilities];

export interface IngestionIssueSourceAssociation {
  readonly sourceId?: string;
  readonly sourceReference?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly batchId?: string;
  readonly batchItemId?: string;
  readonly fileName?: string;
}

export interface IngestionIssue {
  readonly code: string;
  readonly message: string;
  readonly category: IngestionIssueCategory;
  readonly severity: IngestionIssueSeverity;
  readonly recoverability?: IngestionIssueRecoverability;
  readonly retrySuggested?: boolean;
  readonly source?: IngestionIssueSourceAssociation;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IngestionAssetIdentity {
  readonly assetId: string;
  readonly assetVersion?: string;
}

export interface IngestionLineageSourceReference {
  readonly sourceId?: string;
  readonly sourceReference?: string;
  readonly sourceType?: string;
  readonly mediaType?: string;
  readonly fileName?: string;
  readonly parentSourceId?: string;
  readonly batchId?: string;
  readonly batchItemId?: string;
}

export interface IngestionOutputSummary {
  readonly shapeKind?: string;
  readonly totalCount?: number;
  readonly recordCount?: number;
  readonly textItemCount?: number;
  readonly imageItemCount?: number;
  readonly pageCount?: number;
  readonly sourceCount?: number;
  readonly successCount?: number;
  readonly failureCount?: number;
}

export interface IngestionLineageHook {
  readonly lineageId: string;
  readonly executionId?: string;
  readonly runId?: string;
  readonly preview: boolean;
  readonly producer: IngestionAssetIdentity;
  readonly sources: ReadonlyArray<IngestionLineageSourceReference>;
  readonly output: IngestionOutputSummary;
  readonly configSummary?: Readonly<Record<string, unknown>>;
  readonly parentExecutionId?: string;
  readonly childExecutionIds?: ReadonlyArray<string>;
  readonly capturedAt: string;
}

export interface IngestionLogRecord {
  readonly eventId: string;
  readonly executionId?: string;
  readonly runId?: string;
  readonly executionMode: IngestionExecutionMode;
  readonly preview: boolean;
  readonly status: IngestionExecutionStatus;
  readonly timestamp: string;
  readonly completedAt?: string;
  readonly asset: IngestionAssetIdentity;
  readonly sourceSummary: {
    readonly sourceCount: number;
    readonly primarySourceReference?: string;
    readonly sourceTypes: ReadonlyArray<string>;
  };
  readonly configSummary?: Readonly<Record<string, unknown>>;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly outputSummary: IngestionOutputSummary;
  readonly lineage: IngestionLineageHook;
}

export const Uint8ArraySchema = z.custom<Uint8Array>(
  (value) => value instanceof Uint8Array,
  { message: "Expected a Uint8Array payload." },
);

export const IngestionExecutionContextSchema = z.object({
  executionMode: z.enum([IngestionExecutionModes.execute, IngestionExecutionModes.preview]).default(IngestionExecutionModes.execute),
  sourceId: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  sourceAssetId: z.string().trim().min(1).optional(),
  sourceVersionId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).optional(),
  contentType: z.string().trim().min(1).optional(),
  mediaType: z.string().trim().min(1).optional(),
  groupId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  batchItemId: z.string().trim().min(1).optional(),
});

export type IngestionExecutionContext = z.output<typeof IngestionExecutionContextSchema>;

export const IngestionIssueSourceAssociationSchema = z.object({
  sourceId: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  sourceAssetId: z.string().trim().min(1).optional(),
  sourceVersionId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  batchItemId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).optional(),
});

export const IngestionIssueSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  category: z.enum([
    IngestionIssueCategories.invalidConfiguration,
    IngestionIssueCategories.unsupportedSourceType,
    IngestionIssueCategories.sourceNotFound,
    IngestionIssueCategories.unreadableSource,
    IngestionIssueCategories.parseExtractionFailure,
    IngestionIssueCategories.normalizationFailure,
    IngestionIssueCategories.previewFailure,
    IngestionIssueCategories.batchPartialFailure,
    IngestionIssueCategories.unknownInternalFailure,
  ]),
  severity: z.enum([IngestionIssueSeverities.info, IngestionIssueSeverities.warning, IngestionIssueSeverities.error]),
  recoverability: z.enum([
    IngestionIssueRecoverabilities.none,
    IngestionIssueRecoverabilities.retryable,
    IngestionIssueRecoverabilities.fixConfig,
    IngestionIssueRecoverabilities.fixSource,
    IngestionIssueRecoverabilities.partial,
  ]).optional(),
  retrySuggested: z.boolean().optional(),
  source: IngestionIssueSourceAssociationSchema.optional(),
  path: z.string().trim().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const IngestionPreviewRequestSchema = z.object({
  maxItems: z.number().int().positive().max(100).default(25),
  maxColumns: z.number().int().positive().max(32).default(12),
  maxTextLength: z.number().int().positive().max(2_000).default(320),
  maxPages: z.number().int().positive().max(50).optional(),
});

export type IngestionPreviewRequest = z.output<typeof IngestionPreviewRequestSchema>;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeReadonlyRecord(
  value?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  const entries = Object.entries(value)
    .map(([key, entry]) => [key.trim(), entry] as const)
    .filter(([key]) => key.length > 0);
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  if (!values || values.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze([...new Set(values.map((entry) => entry.trim()).filter(Boolean))]);
}

function createSyntheticId(prefix: string): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${now}-${rand}`;
}

export function createIngestionLineageHook(input: {
  readonly producer: IngestionAssetIdentity;
  readonly executionMode: IngestionExecutionMode;
  readonly capturedAt?: string;
  readonly executionId?: string;
  readonly runId?: string;
  readonly lineageId?: string;
  readonly sources?: ReadonlyArray<IngestionLineageSourceReference>;
  readonly output?: IngestionOutputSummary;
  readonly configSummary?: Readonly<Record<string, unknown>>;
  readonly parentExecutionId?: string;
  readonly childExecutionIds?: ReadonlyArray<string>;
}): IngestionLineageHook {
  const capturedAt = normalizeOptional(input.capturedAt) ?? new Date().toISOString();
  const sources = (input.sources ?? [])
    .map((source) => Object.freeze({
      sourceId: normalizeOptional(source.sourceId),
      sourceReference: normalizeOptional(source.sourceReference),
      sourceType: normalizeOptional(source.sourceType),
      mediaType: normalizeOptional(source.mediaType),
      fileName: normalizeOptional(source.fileName),
      parentSourceId: normalizeOptional(source.parentSourceId),
      batchId: normalizeOptional(source.batchId),
      batchItemId: normalizeOptional(source.batchItemId),
    }))
    .filter((source) => Object.values(source).some((entry) => entry !== undefined));

  const producer = Object.freeze({
    assetId: normalizeOptional(input.producer.assetId) ?? "unknown-ingestor",
    assetVersion: normalizeOptional(input.producer.assetVersion),
  } satisfies IngestionAssetIdentity);

  const output = Object.freeze({
    shapeKind: normalizeOptional(input.output?.shapeKind),
    totalCount: input.output?.totalCount,
    recordCount: input.output?.recordCount,
    textItemCount: input.output?.textItemCount,
    imageItemCount: input.output?.imageItemCount,
    pageCount: input.output?.pageCount,
    sourceCount: input.output?.sourceCount,
    successCount: input.output?.successCount,
    failureCount: input.output?.failureCount,
  } satisfies IngestionOutputSummary);

  return Object.freeze({
    lineageId: normalizeOptional(input.lineageId) ?? createSyntheticId("ingestion-lineage"),
    executionId: normalizeOptional(input.executionId),
    runId: normalizeOptional(input.runId),
    preview: input.executionMode === IngestionExecutionModes.preview,
    producer,
    sources: Object.freeze(sources),
    output,
    configSummary: normalizeReadonlyRecord(input.configSummary),
    parentExecutionId: normalizeOptional(input.parentExecutionId),
    childExecutionIds: normalizeStringArray(input.childExecutionIds),
    capturedAt,
  } satisfies IngestionLineageHook);
}

export function createIngestionLogRecord(input: {
  readonly executionMode: IngestionExecutionMode;
  readonly status: IngestionExecutionStatus;
  readonly asset: IngestionAssetIdentity;
  readonly issues?: ReadonlyArray<IngestionIssue>;
  readonly outputSummary?: IngestionOutputSummary;
  readonly sources?: ReadonlyArray<IngestionLineageSourceReference>;
  readonly configSummary?: Readonly<Record<string, unknown>>;
  readonly executionId?: string;
  readonly runId?: string;
  readonly eventId?: string;
  readonly timestamp?: string;
  readonly completedAt?: string;
  readonly lineage?: IngestionLineageHook;
}): IngestionLogRecord {
  const issues = input.issues ?? Object.freeze([]);
  const warningCount = issues.filter((issue) => issue.severity === IngestionIssueSeverities.warning).length;
  const errorCount = issues.filter((issue) => issue.severity === IngestionIssueSeverities.error).length;
  const sourceTypes = normalizeStringArray((input.sources ?? []).map((source) => source.sourceType ?? "unknown"));
  const sourceCount = Math.max(1, (input.sources ?? []).length);
  const timestamp = normalizeOptional(input.timestamp) ?? new Date().toISOString();
  const lineage = input.lineage ?? createIngestionLineageHook({
    producer: input.asset,
    executionMode: input.executionMode,
    capturedAt: timestamp,
    executionId: input.executionId,
    runId: input.runId,
    sources: input.sources,
    output: input.outputSummary,
    configSummary: input.configSummary,
  });

  return Object.freeze({
    eventId: normalizeOptional(input.eventId) ?? createSyntheticId("ingestion-log"),
    executionId: normalizeOptional(input.executionId),
    runId: normalizeOptional(input.runId),
    executionMode: input.executionMode,
    preview: input.executionMode === IngestionExecutionModes.preview,
    status: input.status,
    timestamp,
    completedAt: normalizeOptional(input.completedAt),
    asset: Object.freeze({
      assetId: normalizeOptional(input.asset.assetId) ?? "unknown-ingestor",
      assetVersion: normalizeOptional(input.asset.assetVersion),
    }),
    sourceSummary: Object.freeze({
      sourceCount,
      primarySourceReference: normalizeOptional(input.sources?.[0]?.sourceReference),
      sourceTypes,
    }),
    configSummary: normalizeReadonlyRecord(input.configSummary),
    warningCount,
    errorCount,
    outputSummary: Object.freeze({
      shapeKind: normalizeOptional(input.outputSummary?.shapeKind),
      totalCount: input.outputSummary?.totalCount,
      recordCount: input.outputSummary?.recordCount,
      textItemCount: input.outputSummary?.textItemCount,
      imageItemCount: input.outputSummary?.imageItemCount,
      pageCount: input.outputSummary?.pageCount,
      sourceCount: input.outputSummary?.sourceCount,
      successCount: input.outputSummary?.successCount,
      failureCount: input.outputSummary?.failureCount,
    } satisfies IngestionOutputSummary),
    lineage,
  } satisfies IngestionLogRecord);
}

export function contextToIssueSource(context?: Partial<IngestionExecutionContext>): IngestionIssueSourceAssociation | undefined {
  if (!context) {
    return undefined;
  }

  const source = Object.freeze({
    sourceId: context.sourceId?.trim() || undefined,
    sourceReference: context.sourceReference?.trim() || undefined,
    sourceAssetId: context.sourceAssetId?.trim() || undefined,
    sourceVersionId: context.sourceVersionId?.trim() || undefined,
    batchId: context.batchId?.trim() || undefined,
    batchItemId: context.batchItemId?.trim() || undefined,
    fileName: context.fileName?.trim() || undefined,
  });

  return Object.values(source).some((entry) => entry !== undefined) ? source : undefined;
}

export function createIngestionIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly category: IngestionIssueCategory;
  readonly severity?: IngestionIssueSeverity;
  readonly recoverability?: IngestionIssueRecoverability;
  readonly retrySuggested?: boolean;
  readonly source?: IngestionIssueSourceAssociation;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): IngestionIssue {
  return Object.freeze({
    code: input.code.trim(),
    message: input.message.trim(),
    category: input.category,
    severity: input.severity ?? IngestionIssueSeverities.error,
    recoverability: input.recoverability,
    retrySuggested: input.retrySuggested,
    source: input.source,
    path: input.path?.trim() || undefined,
    details: input.details,
  });
}

export function toIngestionIssuesFromZodError(
  error: z.ZodError,
  defaultCode: string,
  options?: {
    readonly category?: IngestionIssueCategory;
    readonly source?: IngestionIssueSourceAssociation;
  },
): ReadonlyArray<IngestionIssue> {
  return Object.freeze(error.issues.map((issue) => createIngestionIssue({
    code: defaultCode,
    message: issue.message,
    category: options?.category ?? IngestionIssueCategories.invalidConfiguration,
    severity: IngestionIssueSeverities.error,
    recoverability: IngestionIssueRecoverabilities.fixConfig,
    retrySuggested: false,
    source: options?.source,
    path: issue.path.join(".") || undefined,
    details: Object.freeze({ path: issue.path.join(".") }),
  })));
}

export function toIngestionIssueFromError(input: {
  readonly code: string;
  readonly message: string;
  readonly error: unknown;
  readonly category: IngestionIssueCategory;
  readonly recoverability?: IngestionIssueRecoverability;
  readonly retrySuggested?: boolean;
  readonly source?: IngestionIssueSourceAssociation;
  readonly path?: string;
}): IngestionIssue {
  const cause = input.error instanceof Error ? input.error.message : String(input.error);
  return createIngestionIssue({
    code: input.code,
    message: input.message,
    category: input.category,
    severity: IngestionIssueSeverities.error,
    recoverability: input.recoverability,
    retrySuggested: input.retrySuggested,
    source: input.source,
    path: input.path,
    details: Object.freeze({ cause }),
  });
}

