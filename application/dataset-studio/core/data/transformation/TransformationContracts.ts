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

export interface ITransformationPreview<TOutput extends ITransformationOutput = ITransformationOutput> {
  readonly output: TOutput;
  readonly sample: TransformationInputData;
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
