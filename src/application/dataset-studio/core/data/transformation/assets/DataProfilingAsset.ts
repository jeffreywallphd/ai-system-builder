import { z } from "zod";
import type {
  CanonicalRecordValue,
  CanonicalRecordsShape,
  CanonicalTableShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import {
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";
import { sampleTransformationInputData } from "../TransformationSampling";
import { summarizeNumericValues } from "../TransformationStatistics";

export const DataProfilingInferredTypes = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "date",
  object: "object",
  array: "array",
  null: "null",
  unknown: "unknown",
} as const);

export type DataProfilingInferredType = typeof DataProfilingInferredTypes[keyof typeof DataProfilingInferredTypes];

export const DataProfilingConfigSchema = z.object({
  sampleSize: z.number().int().min(1).max(10000).default(500),
  computeNumericStats: z.boolean().default(true),
  computeDistinctCounts: z.boolean().default(true),
  maxSampleValuesPerField: z.number().int().min(1).max(25).default(5),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
});

export type DataProfilingConfig = z.output<typeof DataProfilingConfigSchema>;

export interface DataProfilingFieldNumericStats {
  readonly count: number;
  readonly sum: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly standardDeviation?: number;
}

export interface DataProfilingFieldProfile {
  readonly fieldName: string;
  readonly rowCount: number;
  readonly nullCount: number;
  readonly nullRatio: number;
  readonly distinctCount?: number;
  readonly inferredTypeRef: DataProfilingInferredType;
  readonly minValue?: string | number;
  readonly maxValue?: string | number;
  readonly numericStats?: DataProfilingFieldNumericStats;
  readonly sampleValues: ReadonlyArray<CanonicalRecordValue>;
}

export interface DataProfilingDatasetSummary {
  readonly rowCount: number;
  readonly profiledRowCount: number;
  readonly fieldCount: number;
  readonly nullCellCount: number;
  readonly nullCellRatio: number;
}

export interface DataProfilingOutput extends ITransformationOutput {
  readonly profile: {
    readonly profiledAt: string;
    readonly summary: DataProfilingDatasetSummary;
    readonly fields: ReadonlyArray<DataProfilingFieldProfile>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
}

const InferredTypeSchema = z.enum([
  DataProfilingInferredTypes.string,
  DataProfilingInferredTypes.number,
  DataProfilingInferredTypes.boolean,
  DataProfilingInferredTypes.date,
  DataProfilingInferredTypes.object,
  DataProfilingInferredTypes.array,
  DataProfilingInferredTypes.null,
  DataProfilingInferredTypes.unknown,
]);

const DataProfilingOutputSchema: z.ZodType<DataProfilingOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  profile: z.object({
    profiledAt: z.string().min(1),
    summary: z.object({
      rowCount: z.number().int().nonnegative(),
      profiledRowCount: z.number().int().nonnegative(),
      fieldCount: z.number().int().nonnegative(),
      nullCellCount: z.number().int().nonnegative(),
      nullCellRatio: z.number().min(0).max(1),
    }),
    fields: z.array(z.object({
      fieldName: z.string().min(1),
      rowCount: z.number().int().nonnegative(),
      nullCount: z.number().int().nonnegative(),
      nullRatio: z.number().min(0).max(1),
      distinctCount: z.number().int().nonnegative().optional(),
      inferredTypeRef: InferredTypeSchema,
      minValue: z.union([z.string(), z.number()]).optional(),
      maxValue: z.union([z.string(), z.number()]).optional(),
      numericStats: z.object({
        count: z.number().int().nonnegative(),
        sum: z.number(),
        mean: z.number(),
        median: z.number(),
        min: z.number(),
        max: z.number(),
        standardDeviation: z.number().optional(),
      }).optional(),
      sampleValues: z.array(z.unknown()),
    })),
  }),
  sampleRows: z.array(z.record(z.unknown())),
});

function toRows(data: CanonicalRecordsShape | CanonicalTableShape): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === "records") {
    return data.records.map((record) => record.fields);
  }

  return data.rows.map((row) => row.cells);
}

function isEmptyLike(value: CanonicalRecordValue | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return typeof value === "string" && value.trim().length === 0;
}

function isNumberLikeString(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function isDateLikeString(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function classifyValue(value: CanonicalRecordValue | undefined): DataProfilingInferredType {
  if (value === undefined || value === null) {
    return DataProfilingInferredTypes.null;
  }
  if (Array.isArray(value)) {
    return DataProfilingInferredTypes.array;
  }

  switch (typeof value) {
    case "number":
      return DataProfilingInferredTypes.number;
    case "boolean":
      return DataProfilingInferredTypes.boolean;
    case "string":
      if (isNumberLikeString(value)) {
        return DataProfilingInferredTypes.number;
      }
      if (isDateLikeString(value)) {
        return DataProfilingInferredTypes.date;
      }
      return DataProfilingInferredTypes.string;
    case "object":
      return DataProfilingInferredTypes.object;
    default:
      return DataProfilingInferredTypes.unknown;
  }
}

function createTypeCountRecord(): Record<DataProfilingInferredType, number> {
  return {
    [DataProfilingInferredTypes.string]: 0,
    [DataProfilingInferredTypes.number]: 0,
    [DataProfilingInferredTypes.boolean]: 0,
    [DataProfilingInferredTypes.date]: 0,
    [DataProfilingInferredTypes.object]: 0,
    [DataProfilingInferredTypes.array]: 0,
    [DataProfilingInferredTypes.null]: 0,
    [DataProfilingInferredTypes.unknown]: 0,
  };
}

function inferFieldType(values: ReadonlyArray<CanonicalRecordValue | undefined>): DataProfilingInferredType {
  const counts = createTypeCountRecord();
  for (const value of values) {
    counts[classifyValue(value)] += 1;
  }

  const nonNullTypes = Object.entries(counts)
    .filter(([type, count]) => type !== DataProfilingInferredTypes.null && count > 0)
    .map(([type, count]) => Object.freeze({ type: type as DataProfilingInferredType, count }));
  if (nonNullTypes.length === 0) {
    return DataProfilingInferredTypes.null;
  }

  return nonNullTypes.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.type.localeCompare(right.type);
  })[0]!.type;
}

function toDistinctKey(value: CanonicalRecordValue | undefined): string {
  return JSON.stringify(value ?? null);
}

function toSafeNumeric(value: CanonicalRecordValue | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && isNumberLikeString(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toSafeDateMillis(value: CanonicalRecordValue | undefined): number | undefined {
  if (typeof value !== "string" || !isDateLikeString(value)) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toFieldMinMax(
  inferredType: DataProfilingInferredType,
  nonNullValues: ReadonlyArray<CanonicalRecordValue>,
  numericSummary: DataProfilingFieldNumericStats | undefined,
): Readonly<{ minValue?: string | number; maxValue?: string | number }> {
  if (inferredType === DataProfilingInferredTypes.number && numericSummary) {
    return Object.freeze({
      minValue: numericSummary.min,
      maxValue: numericSummary.max,
    });
  }

  if (inferredType === DataProfilingInferredTypes.date) {
    const dateMillis = nonNullValues
      .map((value) => toSafeDateMillis(value))
      .filter((value): value is number => value !== undefined);
    if (dateMillis.length === 0) {
      return Object.freeze({});
    }
    const dateSummary = summarizeNumericValues(dateMillis);
    if (!dateSummary) {
      return Object.freeze({});
    }
    return Object.freeze({
      minValue: new Date(dateSummary.min).toISOString(),
      maxValue: new Date(dateSummary.max).toISOString(),
    });
  }

  if (inferredType === DataProfilingInferredTypes.string) {
    const stringValues = nonNullValues.filter((value): value is string => typeof value === "string");
    if (stringValues.length === 0) {
      return Object.freeze({});
    }
    const sorted = [...stringValues].sort((left, right) => left.localeCompare(right));
    return Object.freeze({
      minValue: sorted[0],
      maxValue: sorted[sorted.length - 1],
    });
  }

  return Object.freeze({});
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

function collectSampleValues(
  values: ReadonlyArray<CanonicalRecordValue | undefined>,
  maxSampleValues: number,
): ReadonlyArray<CanonicalRecordValue> {
  const distinct = new Set<string>();
  const samples: CanonicalRecordValue[] = [];
  for (const value of values) {
    if (isEmptyLike(value)) {
      continue;
    }
    const key = toDistinctKey(value);
    if (distinct.has(key)) {
      continue;
    }
    distinct.add(key);
    samples.push(value as CanonicalRecordValue);
    if (samples.length >= maxSampleValues) {
      break;
    }
  }
  return Object.freeze(samples);
}

export class DataProfilingAsset extends BaseTransformationAsset<
  ITransformationInput,
  DataProfilingOutput,
  DataProfilingConfig
> {
  public static readonly assetId = "data-profiling";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: DataProfilingAsset.assetId,
      name: "Data Profiling",
      description: "Generates lightweight per-field profile statistics for canonical records/table data.",
      version: DataProfilingAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: DataProfilingOutputSchema,
      configSchema: DataProfilingConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: DataProfilingConfig): Promise<DataProfilingOutput> {
    const sampledData = sampleTransformationInputData(input.data, config.sampleSize);
    const sampledRows = toRows(sampledData);
    const allRows = toRows(input.data);
    const fieldNames = collectFieldNames(sampledRows);

    let datasetNullCellCount = 0;
    const fields = fieldNames.map((fieldName) => {
      const values = sampledRows.map((row) => row[fieldName]);
      const nonNullValues = values.filter((value): value is CanonicalRecordValue => !isEmptyLike(value));
      const nullCount = values.length - nonNullValues.length;
      datasetNullCellCount += nullCount;

      const inferredTypeRef = inferFieldType(values);
      const distinctCount = config.computeDistinctCounts
        ? new Set(values.map((value) => toDistinctKey(value))).size
        : undefined;
      const numericValues = nonNullValues
        .map((value) => toSafeNumeric(value))
        .filter((value): value is number => value !== undefined);
      const numericSummary = config.computeNumericStats
        ? summarizeNumericValues(numericValues, { singleValueStandardDeviationZero: true })
        : undefined;
      const minMax = toFieldMinMax(inferredTypeRef, nonNullValues, numericSummary);

      return Object.freeze({
        fieldName,
        rowCount: values.length,
        nullCount,
        nullRatio: values.length === 0 ? 0 : nullCount / values.length,
        distinctCount,
        inferredTypeRef,
        minValue: minMax.minValue,
        maxValue: minMax.maxValue,
        numericStats: config.computeNumericStats && inferredTypeRef === DataProfilingInferredTypes.number && numericSummary
          ? Object.freeze({
            count: numericSummary.count,
            sum: numericSummary.sum,
            mean: numericSummary.mean,
            median: numericSummary.median,
            min: numericSummary.min,
            max: numericSummary.max,
            standardDeviation: numericSummary.standardDeviation,
          } satisfies DataProfilingFieldNumericStats)
          : undefined,
        sampleValues: collectSampleValues(values, config.maxSampleValuesPerField),
      } satisfies DataProfilingFieldProfile);
    });

    const profiledCellCount = sampledRows.length * fieldNames.length;
    return Object.freeze({
      data: input.data,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt: new Date().toISOString(),
      }),
      profile: Object.freeze({
        profiledAt: new Date().toISOString(),
        summary: Object.freeze({
          rowCount: allRows.length,
          profiledRowCount: sampledRows.length,
          fieldCount: fieldNames.length,
          nullCellCount: datasetNullCellCount,
          nullCellRatio: profiledCellCount === 0 ? 0 : datasetNullCellCount / profiledCellCount,
        } satisfies DataProfilingDatasetSummary),
        fields: Object.freeze(fields),
      }),
      sampleRows: Object.freeze(sampledRows.slice(0, config.previewSampleSize)),
    });
  }
}

