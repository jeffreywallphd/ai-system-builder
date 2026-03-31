import { z } from "zod";

export const IngestionContractVersion = "1.0.0";

export const IngestionExecutionModes = Object.freeze({
  execute: "execute",
  preview: "preview",
} as const);

export type IngestionExecutionMode = typeof IngestionExecutionModes[keyof typeof IngestionExecutionModes];

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

