import { z } from "zod";

export const IngestionContractVersion = "1.0.0";

export const IngestionExecutionModes = Object.freeze({
  execute: "execute",
  preview: "preview",
} as const);

export type IngestionExecutionMode = typeof IngestionExecutionModes[keyof typeof IngestionExecutionModes];

export const IngestionIssueSeverities = Object.freeze({
  warning: "warning",
  error: "error",
} as const);

export type IngestionIssueSeverity = typeof IngestionIssueSeverities[keyof typeof IngestionIssueSeverities];

export interface IngestionIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: IngestionIssueSeverity;
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

export const IngestionIssueSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  severity: z.enum([IngestionIssueSeverities.warning, IngestionIssueSeverities.error]),
  path: z.string().trim().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export function toIngestionIssuesFromZodError(
  error: z.ZodError,
  defaultCode: string,
): ReadonlyArray<IngestionIssue> {
  return Object.freeze(error.issues.map((issue) => Object.freeze({
    code: defaultCode,
    message: issue.message,
    severity: IngestionIssueSeverities.error,
    path: issue.path.join(".") || undefined,
    details: Object.freeze({ path: issue.path.join(".") }),
  })));
}

