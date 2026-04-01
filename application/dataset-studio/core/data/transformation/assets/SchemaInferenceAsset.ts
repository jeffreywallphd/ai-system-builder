import { z } from "zod";
import type {
  CanonicalRecordValue,
  CanonicalRecordsShape,
  CanonicalTableShape,
} from "../../../../../../domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import { summarizeNumericValues } from "../TransformationStatistics";
import {
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";
import { sampleTransformationInputData } from "../TransformationSampling";

export const SchemaInferenceModes = Object.freeze({
  strict: "strict",
  permissive: "permissive",
} as const);

export type SchemaInferenceMode = typeof SchemaInferenceModes[keyof typeof SchemaInferenceModes];

export const SchemaInferenceConfigSchema = z.object({
  sampleSize: z.number().int().min(1).max(10000).default(250),
  inferenceMode: z.enum([SchemaInferenceModes.strict, SchemaInferenceModes.permissive]).default(SchemaInferenceModes.permissive),
  previewSampleSize: z.number().int().min(1).max(250).default(25),
});

export type SchemaInferenceConfig = z.output<typeof SchemaInferenceConfigSchema>;

export const SchemaInferenceFieldTypes = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "date",
  object: "object",
  array: "array",
  null: "null",
  unknown: "unknown",
} as const);

export type SchemaInferenceFieldType = typeof SchemaInferenceFieldTypes[keyof typeof SchemaInferenceFieldTypes];

export const SchemaInferenceTextKinds = Object.freeze({
  categorical: "categorical",
  freeText: "free-text",
} as const);

export interface SchemaInferenceFieldStats {
  readonly sampleCount: number;
  readonly nonNullCount: number;
  readonly nullCount: number;
  readonly distinctCount: number;
  readonly mean?: number;
  readonly min?: number;
  readonly max?: number;
  readonly standardDeviation?: number;
  readonly averageLength?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface SchemaInferenceField {
  readonly fieldName: string;
  readonly inferredType: SchemaInferenceFieldType;
  readonly nullable: boolean;
  readonly textKind?: "categorical" | "free-text";
  readonly stats: SchemaInferenceFieldStats;
}

export interface SchemaInferenceResultSchema {
  readonly inferredAt: string;
  readonly sampleSize: number;
  readonly inferenceMode: SchemaInferenceMode;
  readonly fields: ReadonlyArray<SchemaInferenceField>;
  readonly typeSummary: Readonly<Record<string, SchemaInferenceFieldType>>;
}

export interface SchemaInferenceOutput extends ITransformationOutput {
  readonly schema: SchemaInferenceResultSchema;
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
}

const SchemaInferenceFieldStatsSchema = z.object({
  sampleCount: z.number().int().nonnegative(),
  nonNullCount: z.number().int().nonnegative(),
  nullCount: z.number().int().nonnegative(),
  distinctCount: z.number().int().nonnegative(),
  mean: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  standardDeviation: z.number().optional(),
  averageLength: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
});

const SchemaInferenceFieldSchema = z.object({
  fieldName: z.string().min(1),
  inferredType: z.enum([
    SchemaInferenceFieldTypes.string,
    SchemaInferenceFieldTypes.number,
    SchemaInferenceFieldTypes.boolean,
    SchemaInferenceFieldTypes.date,
    SchemaInferenceFieldTypes.object,
    SchemaInferenceFieldTypes.array,
    SchemaInferenceFieldTypes.null,
    SchemaInferenceFieldTypes.unknown,
  ]),
  nullable: z.boolean(),
  textKind: z.enum([SchemaInferenceTextKinds.categorical, SchemaInferenceTextKinds.freeText]).optional(),
  stats: SchemaInferenceFieldStatsSchema,
});

const SchemaInferenceOutputSchema: z.ZodType<SchemaInferenceOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  schema: z.object({
    inferredAt: z.string().min(1),
    sampleSize: z.number().int().nonnegative(),
    inferenceMode: z.enum([SchemaInferenceModes.strict, SchemaInferenceModes.permissive]),
    fields: z.array(SchemaInferenceFieldSchema),
    typeSummary: z.record(z.enum([
      SchemaInferenceFieldTypes.string,
      SchemaInferenceFieldTypes.number,
      SchemaInferenceFieldTypes.boolean,
      SchemaInferenceFieldTypes.date,
      SchemaInferenceFieldTypes.object,
      SchemaInferenceFieldTypes.array,
      SchemaInferenceFieldTypes.null,
      SchemaInferenceFieldTypes.unknown,
    ])),
  }),
  sampleRows: z.array(z.record(z.unknown())),
});

function toRows(data: CanonicalRecordsShape | CanonicalTableShape): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === "records") {
    return data.records.map((record) => record.fields);
  }

  return data.rows.map((row) => row.cells);
}

function collectFieldNames(rows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>): ReadonlyArray<string> {
  const names = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      names.add(key);
    }
  }

  return Object.freeze([...names].sort((left, right) => left.localeCompare(right)));
}

function isBooleanLike(value: string): boolean {
  return ["true", "false", "yes", "no", "y", "n", "1", "0"].includes(value.toLowerCase());
}

function isNumberLike(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function isDateLike(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  if (!/[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}/.test(value) && Number.isNaN(Date.parse(value))) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function classifyValueType(value: CanonicalRecordValue | undefined): SchemaInferenceFieldType {
  if (value === undefined || value === null) {
    return SchemaInferenceFieldTypes.null;
  }

  if (Array.isArray(value)) {
    return SchemaInferenceFieldTypes.array;
  }

  switch (typeof value) {
    case "number":
      return SchemaInferenceFieldTypes.number;
    case "boolean":
      return SchemaInferenceFieldTypes.boolean;
    case "string":
      if (isBooleanLike(value)) {
        return SchemaInferenceFieldTypes.boolean;
      }
      if (isNumberLike(value)) {
        return SchemaInferenceFieldTypes.number;
      }
      if (isDateLike(value)) {
        return SchemaInferenceFieldTypes.date;
      }
      return SchemaInferenceFieldTypes.string;
    case "object":
      return SchemaInferenceFieldTypes.object;
    default:
      return SchemaInferenceFieldTypes.unknown;
  }
}

function createDistinctKey(value: CanonicalRecordValue | undefined): string {
  return JSON.stringify(value ?? null);
}

function inferTextKind(values: ReadonlyArray<string>): SchemaInferenceField["textKind"] {
  if (values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.toLowerCase());

  if (normalized.length === 0) {
    return undefined;
  }

  const distinctCount = new Set(normalized).size;
  const distinctRatio = distinctCount / normalized.length;
  const averageLength = normalized.reduce((total, value) => total + value.length, 0) / normalized.length;
  if (distinctCount <= 50 && distinctRatio <= 0.25 && averageLength <= 32) {
    return SchemaInferenceTextKinds.categorical;
  }
  return SchemaInferenceTextKinds.freeText;
}

function inferFieldTypeByMode(
  counts: Readonly<Record<SchemaInferenceFieldType, number>>,
  mode: SchemaInferenceMode,
): SchemaInferenceFieldType {
  const nonNullEntries = Object.entries(counts)
    .filter(([type, count]) => type !== SchemaInferenceFieldTypes.null && count > 0)
    .map(([type, count]) => ({ type: type as SchemaInferenceFieldType, count }));
  if (nonNullEntries.length === 0) {
    return SchemaInferenceFieldTypes.null;
  }
  if (nonNullEntries.length === 1) {
    return nonNullEntries[0]!.type;
  }

  if (mode === SchemaInferenceModes.strict) {
    return SchemaInferenceFieldTypes.string;
  }

  return nonNullEntries
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.type.localeCompare(right.type);
    })[0]!.type;
}

function toFieldStats(
  values: ReadonlyArray<CanonicalRecordValue | undefined>,
  inferredType: SchemaInferenceFieldType,
): SchemaInferenceFieldStats {
  const normalized = values.map((value) => value ?? null);
  const nonNullValues = normalized.filter((value): value is Exclude<CanonicalRecordValue, null> => value !== null);
  const numericValues = nonNullValues
    .map((value) => typeof value === "number" ? value : typeof value === "string" && isNumberLike(value) ? Number(value) : undefined)
    .filter((value): value is number => value !== undefined);
  const stringValues = nonNullValues.filter((value): value is string => typeof value === "string");
  const lengths = stringValues.map((value) => value.length);
  const numericSummary = summarizeNumericValues(numericValues, { singleValueStandardDeviationZero: true });
  const lengthSummary = summarizeNumericValues(lengths);
  const distinctCount = new Set(normalized.map((value) => createDistinctKey(value))).size;

  return Object.freeze({
    sampleCount: values.length,
    nonNullCount: nonNullValues.length,
    nullCount: values.length - nonNullValues.length,
    distinctCount,
    mean: inferredType === SchemaInferenceFieldTypes.number ? numericSummary?.mean : undefined,
    min: inferredType === SchemaInferenceFieldTypes.number ? numericSummary?.min : undefined,
    max: inferredType === SchemaInferenceFieldTypes.number ? numericSummary?.max : undefined,
    standardDeviation: inferredType === SchemaInferenceFieldTypes.number ? numericSummary?.standardDeviation : undefined,
    averageLength: inferredType === SchemaInferenceFieldTypes.string ? lengthSummary?.mean : undefined,
    minLength: inferredType === SchemaInferenceFieldTypes.string ? lengthSummary?.min : undefined,
    maxLength: inferredType === SchemaInferenceFieldTypes.string ? lengthSummary?.max : undefined,
  });
}

function createTypeCountRecord(): Record<SchemaInferenceFieldType, number> {
  return {
    [SchemaInferenceFieldTypes.string]: 0,
    [SchemaInferenceFieldTypes.number]: 0,
    [SchemaInferenceFieldTypes.boolean]: 0,
    [SchemaInferenceFieldTypes.date]: 0,
    [SchemaInferenceFieldTypes.object]: 0,
    [SchemaInferenceFieldTypes.array]: 0,
    [SchemaInferenceFieldTypes.null]: 0,
    [SchemaInferenceFieldTypes.unknown]: 0,
  };
}

export class SchemaInferenceAsset extends BaseTransformationAsset<
  ITransformationInput,
  SchemaInferenceOutput,
  SchemaInferenceConfig
> {
  public static readonly assetId = "schema-inference";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: SchemaInferenceAsset.assetId,
      name: "Schema Inference",
      description: "Infers column-level schema metadata from canonical records/table inputs.",
      version: SchemaInferenceAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: SchemaInferenceOutputSchema,
      configSchema: SchemaInferenceConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: SchemaInferenceConfig): Promise<SchemaInferenceOutput> {
    const sampledData = sampleTransformationInputData(input.data, config.sampleSize);
    const sampledRows = toRows(sampledData);
    const fieldNames = collectFieldNames(sampledRows);

    const fields = fieldNames.map((fieldName) => {
      const values = sampledRows.map((row) => row[fieldName]);
      const inferredTypes = values.map((value) => classifyValueType(value));
      const counts = createTypeCountRecord();
      for (const inferredType of inferredTypes) {
        counts[inferredType] += 1;
      }

      const inferredType = inferFieldTypeByMode(counts, config.inferenceMode);
      const textSamples = values.filter((value): value is string => typeof value === "string");
      const textKind = inferredType === SchemaInferenceFieldTypes.string ? inferTextKind(textSamples) : undefined;

      return Object.freeze({
        fieldName,
        inferredType,
        nullable: counts[SchemaInferenceFieldTypes.null] > 0,
        textKind,
        stats: toFieldStats(values, inferredType),
      } satisfies SchemaInferenceField);
    });

    const typeSummary = Object.freeze(Object.fromEntries(fields.map((field) => [field.fieldName, field.inferredType])));
    return Object.freeze({
      data: input.data,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt: new Date().toISOString(),
      }),
      schema: Object.freeze({
        inferredAt: new Date().toISOString(),
        sampleSize: sampledRows.length,
        inferenceMode: config.inferenceMode,
        fields: Object.freeze(fields),
        typeSummary,
      }),
      sampleRows: Object.freeze(sampledRows.slice(0, config.previewSampleSize)),
    });
  }
}
