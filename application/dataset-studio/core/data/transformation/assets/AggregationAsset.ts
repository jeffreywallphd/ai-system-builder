import { z } from "zod";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalTableRow,
} from "../../../../../../domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import {
  AggregationNullHandlingModes,
  AggregationOperations,
  createDefaultAggregationOutputField,
  determineSkippedAggregations,
  evaluateAggregationDefinition,
  groupAggregationRows,
  type AggregationDefinition,
  type AggregationNullHandlingMode,
  type AggregationOperation,
  type AggregationRow,
  type AggregationSkippedDefinition,
} from "../AggregationUtils";
import { rebuildTableColumnsFromRows } from "../TransformationPreviewUtils";
import {
  TransformationInputDataKinds,
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";

const AggregationDefinitionSchema = z.object({
  sourceField: z.string().trim().min(1).optional(),
  operation: z.enum([
    AggregationOperations.count,
    AggregationOperations.sum,
    AggregationOperations.avg,
    AggregationOperations.min,
    AggregationOperations.max,
    AggregationOperations.distinctCount,
    AggregationOperations.first,
    AggregationOperations.last,
  ]),
  outputField: z.string().trim().min(1).optional(),
});

export const AggregationConfigSchema = z.object({
  groupByFields: z.array(z.string().trim().min(1)).min(1),
  aggregations: z.array(AggregationDefinitionSchema).min(1),
  nullHandlingMode: z.enum([
    AggregationNullHandlingModes.exclude,
    AggregationNullHandlingModes.include,
  ]).default(AggregationNullHandlingModes.exclude),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const duplicateGroupBy = new Set<string>();
  value.groupByFields.forEach((fieldName, index) => {
    if (duplicateGroupBy.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["groupByFields", index],
        message: `Duplicate groupBy field '${fieldName}' is not allowed.`,
      });
    }
    duplicateGroupBy.add(fieldName);
  });

  const outputFields = new Set<string>();
  value.aggregations.forEach((entry, index) => {
    const requiresSourceField = entry.operation !== AggregationOperations.count;
    if (requiresSourceField && !entry.sourceField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregations", index, "sourceField"],
        message: `Operation '${entry.operation}' requires a sourceField.`,
      });
    }

    const outputField = entry.outputField?.trim() || createDefaultAggregationOutputField(entry);
    if (outputFields.has(outputField)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregations", index, "outputField"],
        message: `Duplicate aggregation output field '${outputField}' is not allowed.`,
      });
    }
    outputFields.add(outputField);

    if (value.groupByFields.includes(outputField)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aggregations", index, "outputField"],
        message: `Aggregation output field '${outputField}' cannot overlap with groupBy fields.`,
      });
    }
  });
});

export type AggregationConfig = z.output<typeof AggregationConfigSchema>;

interface AggregationOperationResult {
  readonly operation: AggregationOperation;
  readonly sourceField?: string;
  readonly outputField: string;
}

interface AggregationSkippedResult extends AggregationSkippedDefinition {}

export interface AggregationOutput extends ITransformationOutput {
  readonly aggregation: {
    readonly aggregatedAt: string;
    readonly groupByFields: ReadonlyArray<string>;
    readonly nullHandlingMode: AggregationNullHandlingMode;
    readonly inputRowCount: number;
    readonly outputRowCount: number;
    readonly operationsApplied: ReadonlyArray<AggregationOperationResult>;
    readonly skippedAggregations: ReadonlyArray<AggregationSkippedResult>;
    readonly ignoredFieldNames: ReadonlyArray<string>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly groupByFields: ReadonlyArray<string>;
    readonly operationOutputFields: ReadonlyArray<string>;
    readonly representativeRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
    readonly rowCounts: {
      readonly input: number;
      readonly output: number;
    };
  };
}

const AggregationOutputSchema: z.ZodType<AggregationOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  aggregation: z.object({
    aggregatedAt: z.string().min(1),
    groupByFields: z.array(z.string().min(1)),
    nullHandlingMode: z.enum([
      AggregationNullHandlingModes.exclude,
      AggregationNullHandlingModes.include,
    ]),
    inputRowCount: z.number().int().nonnegative(),
    outputRowCount: z.number().int().nonnegative(),
    operationsApplied: z.array(z.object({
      operation: z.enum([
        AggregationOperations.count,
        AggregationOperations.sum,
        AggregationOperations.avg,
        AggregationOperations.min,
        AggregationOperations.max,
        AggregationOperations.distinctCount,
        AggregationOperations.first,
        AggregationOperations.last,
      ]),
      sourceField: z.string().min(1).optional(),
      outputField: z.string().min(1),
    })),
    skippedAggregations: z.array(z.object({
      operation: z.enum([
        AggregationOperations.count,
        AggregationOperations.sum,
        AggregationOperations.avg,
        AggregationOperations.min,
        AggregationOperations.max,
        AggregationOperations.distinctCount,
        AggregationOperations.first,
        AggregationOperations.last,
      ]),
      sourceField: z.string().min(1).optional(),
      outputField: z.string().min(1),
      reason: z.string().min(1),
    })),
    ignoredFieldNames: z.array(z.string().min(1)),
  }),
  sampleRows: z.array(z.record(z.unknown())),
  preview: z.object({
    groupByFields: z.array(z.string().min(1)),
    operationOutputFields: z.array(z.string().min(1)),
    representativeRows: z.array(z.record(z.unknown())),
    rowCounts: z.object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    }),
  }),
});

function toAggregationRows(data: ITransformationInput["data"]): ReadonlyArray<AggregationRow> {
  if (data.kind === TransformationInputDataKinds.records) {
    return Object.freeze(data.records.map((record) => Object.freeze({ rowId: record.recordId, fields: record.fields })));
  }
  return Object.freeze(data.rows.map((row) => Object.freeze({ rowId: row.rowId, fields: row.cells })));
}

function toSampleRows(
  data: ITransformationInput["data"],
  previewSampleSize: number,
): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === TransformationInputDataKinds.records) {
    return Object.freeze(data.records.slice(0, previewSampleSize).map((record) => record.fields));
  }
  return Object.freeze(data.rows.slice(0, previewSampleSize).map((row) => row.cells));
}

function normalizeAggregationDefinitions(config: AggregationConfig): ReadonlyArray<AggregationDefinition> {
  return Object.freeze(config.aggregations.map((entry) => Object.freeze({
    operation: entry.operation,
    sourceField: entry.sourceField,
    outputField: entry.outputField?.trim() || createDefaultAggregationOutputField(entry),
  })));
}

function collectInputFieldNames(data: ITransformationInput["data"]): ReadonlyArray<string> {
  const fieldNames = new Set<string>();
  if (data.kind === TransformationInputDataKinds.records) {
    data.records.forEach((record) => Object.keys(record.fields).forEach((fieldName) => fieldNames.add(fieldName)));
  } else {
    data.columns.forEach((column) => fieldNames.add(column.columnId));
    data.rows.forEach((row) => Object.keys(row.cells).forEach((fieldName) => fieldNames.add(fieldName)));
  }
  return Object.freeze([...fieldNames].sort((left, right) => left.localeCompare(right)));
}

function buildAggregatedFields(input: {
  readonly groupValues: Readonly<Record<string, CanonicalRecordValue>>;
  readonly definitions: ReadonlyArray<AggregationDefinition>;
  readonly skippedOutputFields: ReadonlySet<string>;
  readonly rows: ReadonlyArray<AggregationRow>;
  readonly nullHandlingMode: AggregationNullHandlingMode;
}): Readonly<Record<string, CanonicalRecordValue>> {
  const next: Record<string, CanonicalRecordValue> = {};
  Object.entries(input.groupValues).forEach(([key, value]) => {
    next[key] = value;
  });

  input.definitions.forEach((definition) => {
    if (input.skippedOutputFields.has(definition.outputField)) {
      next[definition.outputField] = null;
      return;
    }
    next[definition.outputField] = evaluateAggregationDefinition(input.rows, definition, input.nullHandlingMode);
  });

  return Object.freeze(next);
}

export class AggregationAsset extends BaseTransformationAsset<
  ITransformationInput,
  AggregationOutput,
  AggregationConfig
> {
  public static readonly assetId = "aggregation";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: AggregationAsset.assetId,
      name: "Aggregation",
      description: "Groups canonical records/table rows and computes deterministic aggregation outputs for downstream preparation and analytics shaping.",
      version: AggregationAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: AggregationOutputSchema,
      configSchema: AggregationConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: AggregationConfig): Promise<AggregationOutput> {
    const rows = toAggregationRows(input.data);
    const definitions = normalizeAggregationDefinitions(config);
    const skipped = determineSkippedAggregations(rows, definitions, config.nullHandlingMode);
    const skippedOutputFields = new Set(skipped.map((entry) => entry.outputField));
    const grouped = groupAggregationRows(rows, config.groupByFields);
    const executedAt = new Date().toISOString();

    const operationResults = Object.freeze(definitions
      .filter((definition) => !skippedOutputFields.has(definition.outputField))
      .map((definition) => Object.freeze({
        operation: definition.operation,
        sourceField: definition.sourceField,
        outputField: definition.outputField,
      } satisfies AggregationOperationResult)));

    const skippedResults = Object.freeze(skipped.map((entry) => Object.freeze({
      operation: entry.operation,
      sourceField: entry.sourceField,
      outputField: entry.outputField,
      reason: entry.reason,
    } satisfies AggregationSkippedResult)));

    const groupedRows = grouped.map((group, index) => Object.freeze({
      rowId: `agg-${String(index + 1).padStart(6, "0")}`,
      values: buildAggregatedFields({
        groupValues: group.groupValues,
        definitions,
        skippedOutputFields,
        rows: group.rows,
        nullHandlingMode: config.nullHandlingMode,
      }),
    }));

    const referencedFields = new Set<string>(config.groupByFields);
    definitions.forEach((definition) => {
      if (definition.sourceField) {
        referencedFields.add(definition.sourceField);
      }
    });

    const ignoredFieldNames = Object.freeze(
      collectInputFieldNames(input.data).filter((fieldName) => !referencedFields.has(fieldName)),
    );

    const outputData = input.data.kind === TransformationInputDataKinds.records
      ? createCanonicalRecordsShape({
        records: Object.freeze(groupedRows.map((row) => Object.freeze({
          recordId: row.rowId,
          fields: row.values,
        } satisfies CanonicalRecordItem))),
        metadata: input.data.metadata,
      })
      : createCanonicalTableShape({
        columns: rebuildTableColumnsFromRows(
          Object.freeze([]),
          Object.freeze(groupedRows.map((row) => Object.freeze({
            rowId: row.rowId,
            cells: row.values,
          } satisfies CanonicalTableRow))),
        ),
        rows: Object.freeze(groupedRows.map((row) => Object.freeze({
          rowId: row.rowId,
          cells: row.values,
        } satisfies CanonicalTableRow))),
        metadata: input.data.metadata,
      });

    const representativeRows = toSampleRows(outputData, config.previewSampleSize);

    return Object.freeze({
      data: outputData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt,
      }),
      aggregation: Object.freeze({
        aggregatedAt: executedAt,
        groupByFields: Object.freeze([...config.groupByFields]),
        nullHandlingMode: config.nullHandlingMode,
        inputRowCount: rows.length,
        outputRowCount: groupedRows.length,
        operationsApplied: operationResults,
        skippedAggregations: skippedResults,
        ignoredFieldNames,
      }),
      sampleRows: representativeRows,
      preview: Object.freeze({
        groupByFields: Object.freeze([...config.groupByFields]),
        operationOutputFields: Object.freeze(definitions.map((definition) => definition.outputField)),
        representativeRows,
        rowCounts: Object.freeze({
          input: rows.length,
          output: groupedRows.length,
        }),
      }),
    });
  }
}
