import { z } from "zod";
import type { CanonicalRecordsShape, CanonicalTableShape } from "../../../../../domain/dataset-studio/CanonicalDataShapes";

export const TransformationInputDataKinds = Object.freeze({
  records: "records",
  table: "table",
} as const);

export type TransformationInputDataKind =
  typeof TransformationInputDataKinds[keyof typeof TransformationInputDataKinds];

export type TransformationInputData = CanonicalRecordsShape | CanonicalTableShape;

export interface ITransformationConfig {
  readonly [key: string]: unknown;
}

export interface ITransformationInput {
  readonly data: TransformationInputData;
}

export interface ITransformationOutput {
  readonly data: TransformationInputData;
  readonly metadata: {
    readonly assetId: string;
    readonly assetVersion: string;
    readonly executedAt: string;
  };
}

export const TransformationPreviewIssueSeverities = Object.freeze({
  info: "info",
  warning: "warning",
  error: "error",
} as const);

export type TransformationPreviewIssueSeverity =
  typeof TransformationPreviewIssueSeverities[keyof typeof TransformationPreviewIssueSeverities];

export interface TransformationPreviewIssue {
  readonly severity: TransformationPreviewIssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface TransformationPreviewChangeSummary {
  readonly inputRowCount: number;
  readonly outputRowCount: number;
  readonly sampledInputRowCount: number;
  readonly sampledOutputRowCount: number;
  readonly changedRowCount: number;
  readonly addedRowCount: number;
  readonly removedRowCount: number;
  readonly changedFieldCount: number;
  readonly changedFields: ReadonlyArray<string>;
}

export interface TransformationPreviewRowSample {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface TransformationPreviewDiffPatch {
  readonly kind: "json";
  readonly changes: ReadonlyArray<string>;
  readonly truncated: boolean;
}

export interface TransformationAssetPreviewContract {
  readonly contractVersion: "1.0.0";
  readonly generatedAt: string;
  readonly asset: {
    readonly assetId: string;
    readonly assetVersion: string;
  };
  readonly summary: TransformationPreviewChangeSummary;
  readonly samples: {
    readonly inputRows: ReadonlyArray<TransformationPreviewRowSample>;
    readonly outputRows: ReadonlyArray<TransformationPreviewRowSample>;
  };
  readonly diffs?: {
    readonly structuredPatch?: TransformationPreviewDiffPatch;
  };
  readonly diagnostics: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly warnings: ReadonlyArray<TransformationPreviewIssue>;
  readonly errors: ReadonlyArray<TransformationPreviewIssue>;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface ITransformationPreview<TOutput extends ITransformationOutput = ITransformationOutput> {
  readonly output: TOutput;
  readonly sample: TransformationInputData;
  readonly normalized: TransformationAssetPreviewContract;
}

export interface ITransformationAsset<
  TInput extends ITransformationInput = ITransformationInput,
  TOutput extends ITransformationOutput = ITransformationOutput,
  TConfig extends ITransformationConfig = ITransformationConfig,
> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly configSchema: z.ZodType<TConfig>;
  execute(input: TInput, config?: Partial<TConfig>): Promise<TOutput>;
  preview(input: TInput, config?: Partial<TConfig>): Promise<ITransformationPreview<TOutput>>;
}

const CanonicalRecordValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(CanonicalRecordValueSchema),
  z.record(CanonicalRecordValueSchema),
]));

const CanonicalRecordItemSchema = z.object({
  recordId: z.string().min(1),
  fields: z.record(CanonicalRecordValueSchema),
  metadata: z.record(CanonicalRecordValueSchema).optional(),
});

const CanonicalRecordsShapeSchema = z.object({
  kind: z.literal(TransformationInputDataKinds.records),
  records: z.array(CanonicalRecordItemSchema),
  metadata: z.object({
    schemaVersion: z.string().min(1),
  }).passthrough(),
});

const CanonicalTableShapeSchema = z.object({
  kind: z.literal(TransformationInputDataKinds.table),
  columns: z.array(z.object({
    columnId: z.string().min(1),
    label: z.string().min(1),
    valueType: z.enum(["string", "number", "boolean", "object", "array", "null", "unknown"]),
  })),
  rows: z.array(z.object({
    rowId: z.string().min(1),
    cells: z.record(CanonicalRecordValueSchema),
    sourceRecordId: z.string().optional(),
    metadata: z.record(CanonicalRecordValueSchema).optional(),
  })),
  metadata: z.object({
    schemaVersion: z.string().min(1),
  }).passthrough(),
});

export const TransformationInputDataSchema = z.union([
  CanonicalRecordsShapeSchema,
  CanonicalTableShapeSchema,
]);

export const TransformationInputSchema: z.ZodType<ITransformationInput> = z.object({
  data: TransformationInputDataSchema,
});

export const TransformationConfigSchema: z.ZodType<ITransformationConfig> = z.record(z.unknown());
