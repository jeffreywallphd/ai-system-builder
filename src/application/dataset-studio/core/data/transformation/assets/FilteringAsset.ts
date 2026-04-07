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
  evaluateFilteringConditionGroup,
  FilteringConditionOperators,
  FilteringLogicalOperators,
  type FilteringConditionDefinition,
} from "../FilteringUtils";
import {
  buildPreviewRowDeltas,
  rebuildTableColumnsFromRows,
  type TransformationPreviewRowDelta,
} from "../TransformationPreviewUtils";
import {
  TransformationInputDataKinds,
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";

export const FilteringModes = Object.freeze({
  include: "include",
  exclude: "exclude",
} as const);

export type FilteringMode = typeof FilteringModes[keyof typeof FilteringModes];

const FilteringConditionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  fieldName: z.string().trim().min(1),
  operator: z.enum([
    FilteringConditionOperators.equals,
    FilteringConditionOperators.notEquals,
    FilteringConditionOperators.in,
    FilteringConditionOperators.notIn,
    FilteringConditionOperators.greaterThan,
    FilteringConditionOperators.greaterThanOrEqual,
    FilteringConditionOperators.lessThan,
    FilteringConditionOperators.lessThanOrEqual,
    FilteringConditionOperators.contains,
    FilteringConditionOperators.notContains,
    FilteringConditionOperators.startsWith,
    FilteringConditionOperators.endsWith,
    FilteringConditionOperators.isNull,
    FilteringConditionOperators.isNotNull,
    FilteringConditionOperators.isEmpty,
    FilteringConditionOperators.isNotEmpty,
  ]),
  value: z.unknown().optional(),
  values: z.array(z.unknown()).optional(),
});

export const FilteringConfigSchema = z.object({
  mode: z.enum([FilteringModes.include, FilteringModes.exclude]).default(FilteringModes.include),
  logicalOperator: z.enum([FilteringLogicalOperators.and, FilteringLogicalOperators.or]).default(FilteringLogicalOperators.and),
  conditions: z.array(FilteringConditionSchema).default([]),
  caseSensitive: z.boolean().default(false),
  trimStrings: z.boolean().default(true),
  treatMissingAsNull: z.boolean().default(true),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seenIds = new Set<string>();
  value.conditions.forEach((condition, index) => {
    const identifier = condition.id?.trim();
    if (identifier) {
      if (seenIds.has(identifier)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["conditions", index, "id"],
          message: `Duplicate condition id '${identifier}' is not allowed.`,
        });
      }
      seenIds.add(identifier);
    }

    const requiresValues = condition.operator === FilteringConditionOperators.in
      || condition.operator === FilteringConditionOperators.notIn;
    const forbidsValue = condition.operator === FilteringConditionOperators.isNull
      || condition.operator === FilteringConditionOperators.isNotNull
      || condition.operator === FilteringConditionOperators.isEmpty
      || condition.operator === FilteringConditionOperators.isNotEmpty;

    if (requiresValues && (!condition.values || condition.values.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conditions", index, "values"],
        message: `Operator '${condition.operator}' requires non-empty 'values'.`,
      });
    }

    if (!requiresValues && !forbidsValue && condition.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conditions", index, "value"],
        message: `Operator '${condition.operator}' requires a 'value'.`,
      });
    }

    if (forbidsValue && (condition.value !== undefined || condition.values !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conditions", index],
        message: `Operator '${condition.operator}' does not use 'value' or 'values'.`,
      });
    }
  });
});

export type FilteringConfig = z.output<typeof FilteringConfigSchema>;

export interface FilteringConditionResult {
  readonly conditionId: string;
  readonly fieldName: string;
  readonly operator: string;
  readonly matchCount: number;
}

export interface FilteringOutput extends ITransformationOutput {
  readonly filtering: {
    readonly filteredAt: string;
    readonly mode: FilteringMode;
    readonly logicalOperator: string;
    readonly conditionCount: number;
    readonly totalRows: number;
    readonly includedRows: number;
    readonly excludedRows: number;
    readonly groupMatchedRows: number;
    readonly conditions: ReadonlyArray<FilteringConditionResult>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly rowDeltas: ReadonlyArray<TransformationPreviewRowDelta>;
    readonly includedRows: ReadonlyArray<Readonly<{ rowId: string; fields: Readonly<Record<string, CanonicalRecordValue>> }>>;
    readonly excludedRows: ReadonlyArray<Readonly<{ rowId: string; fields: Readonly<Record<string, CanonicalRecordValue>> }>>;
    readonly appliedConditions: ReadonlyArray<FilteringConditionResult>;
  };
}

const FilteringConditionResultSchema: z.ZodType<FilteringConditionResult> = z.object({
  conditionId: z.string().min(1),
  fieldName: z.string().min(1),
  operator: z.string().min(1),
  matchCount: z.number().int().nonnegative(),
});

const FilteringOutputSchema: z.ZodType<FilteringOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  filtering: z.object({
    filteredAt: z.string().min(1),
    mode: z.enum([FilteringModes.include, FilteringModes.exclude]),
    logicalOperator: z.enum([FilteringLogicalOperators.and, FilteringLogicalOperators.or]),
    conditionCount: z.number().int().nonnegative(),
    totalRows: z.number().int().nonnegative(),
    includedRows: z.number().int().nonnegative(),
    excludedRows: z.number().int().nonnegative(),
    groupMatchedRows: z.number().int().nonnegative(),
    conditions: z.array(FilteringConditionResultSchema),
  }),
  sampleRows: z.array(z.record(z.unknown())),
  preview: z.object({
    rowDeltas: z.array(z.object({
      rowId: z.string().min(1),
      before: z.record(z.unknown()),
      after: z.record(z.unknown()),
      dropped: z.boolean().optional(),
      fieldDeltas: z.array(z.object({
        fieldName: z.string().min(1),
        before: z.unknown().optional(),
        after: z.unknown().optional(),
        changed: z.boolean(),
        note: z.string().optional(),
      })),
    })),
    includedRows: z.array(z.object({
      rowId: z.string().min(1),
      fields: z.record(z.unknown()),
    })),
    excludedRows: z.array(z.object({
      rowId: z.string().min(1),
      fields: z.record(z.unknown()),
    })),
    appliedConditions: z.array(FilteringConditionResultSchema),
  }),
});

interface FilterRow {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

function toRows(data: ITransformationInput["data"]): ReadonlyArray<FilterRow> {
  if (data.kind === TransformationInputDataKinds.records) {
    return Object.freeze(data.records.map((record) => Object.freeze({
      rowId: record.recordId,
      fields: record.fields,
    })));
  }
  return Object.freeze(data.rows.map((row) => Object.freeze({
    rowId: row.rowId,
    fields: row.cells,
  })));
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

function normalizeConditions(config: FilteringConfig): ReadonlyArray<FilteringConditionDefinition> {
  return Object.freeze(config.conditions.map((condition, index) => Object.freeze({
    id: condition.id ?? `condition-${index + 1}`,
    fieldName: condition.fieldName,
    operator: condition.operator,
    value: condition.value as CanonicalRecordValue | undefined,
    values: condition.values as ReadonlyArray<CanonicalRecordValue> | undefined,
  })));
}

export class FilteringAsset extends BaseTransformationAsset<
  ITransformationInput,
  FilteringOutput,
  FilteringConfig
> {
  public static readonly assetId = "filtering";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: FilteringAsset.assetId,
      name: "Filtering",
      description: "Filters canonical records/table rows with deterministic, inspectable condition groups.",
      version: FilteringAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: FilteringOutputSchema,
      configSchema: FilteringConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: FilteringConfig): Promise<FilteringOutput> {
    const rows = toRows(input.data);
    const conditions = normalizeConditions(config);
    const conditionMatchCounts = new Map<string, number>();
    conditions.forEach((condition) => conditionMatchCounts.set(condition.id, 0));

    const includedRowIds = new Set<string>();
    const excludedRowIds = new Set<string>();
    let groupMatchedRows = 0;
    const hasConditions = conditions.length > 0;
    for (const row of rows) {
      const evaluation = evaluateFilteringConditionGroup(row.fields, conditions, config.logicalOperator, {
        caseSensitive: config.caseSensitive,
        trimStrings: config.trimStrings,
        treatMissingAsNull: config.treatMissingAsNull,
      });
      const groupMatched = hasConditions ? evaluation.matched : false;
      evaluation.conditionEvaluations
        .filter((entry) => entry.matched)
        .forEach((entry) => conditionMatchCounts.set(entry.conditionId, (conditionMatchCounts.get(entry.conditionId) ?? 0) + 1));

      if (groupMatched) {
        groupMatchedRows += 1;
      }

      const includeRow = hasConditions
        ? (config.mode === FilteringModes.include ? groupMatched : !groupMatched)
        : true;
      if (includeRow) {
        includedRowIds.add(row.rowId);
      } else {
        excludedRowIds.add(row.rowId);
      }
    }

    const beforeRows = rows.map((row) => row.fields);
    const executedAt = new Date().toISOString();
    const conditionResults = Object.freeze(conditions.map((condition) => Object.freeze({
      conditionId: condition.id,
      fieldName: condition.fieldName,
      operator: condition.operator,
      matchCount: conditionMatchCounts.get(condition.id) ?? 0,
    } satisfies FilteringConditionResult)));

    if (input.data.kind === TransformationInputDataKinds.records) {
      const filteredRecords = input.data.records
        .filter((record) => includedRowIds.has(record.recordId))
        .map((record) => Object.freeze({ ...record } satisfies CanonicalRecordItem));
      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(filteredRecords),
        metadata: input.data.metadata,
      });
      const afterRows = transformedData.records.map((record) => record.fields);

      return Object.freeze({
        data: transformedData,
        metadata: Object.freeze({
          assetId: this.id,
          assetVersion: this.version,
          executedAt,
        }),
        filtering: Object.freeze({
          filteredAt: executedAt,
          mode: config.mode,
          logicalOperator: config.logicalOperator,
          conditionCount: conditions.length,
          totalRows: rows.length,
          includedRows: filteredRecords.length,
          excludedRows: excludedRowIds.size,
          groupMatchedRows,
          conditions: conditionResults,
        }),
        sampleRows: toSampleRows(transformedData, config.previewSampleSize),
        preview: Object.freeze({
          rowDeltas: buildPreviewRowDeltas({
            beforeRows,
            afterRows,
            rowIds: input.data.records.map((record) => record.recordId),
            afterRowIds: transformedData.records.map((record) => record.recordId),
            targetFields: Object.freeze([...new Set(conditions.map((condition) => condition.fieldName))]),
            droppedRowIds: excludedRowIds,
            sampleSize: config.previewSampleSize,
          }),
          includedRows: Object.freeze(rows
            .filter((row) => includedRowIds.has(row.rowId))
            .slice(0, config.previewSampleSize)
            .map((row) => Object.freeze({ rowId: row.rowId, fields: row.fields }))),
          excludedRows: Object.freeze(rows
            .filter((row) => excludedRowIds.has(row.rowId))
            .slice(0, config.previewSampleSize)
            .map((row) => Object.freeze({ rowId: row.rowId, fields: row.fields }))),
          appliedConditions: conditionResults,
        }),
      });
    }

    const filteredRows = input.data.rows
      .filter((row) => includedRowIds.has(row.rowId))
      .map((row) => Object.freeze({ ...row } satisfies CanonicalTableRow));
    const transformedData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, filteredRows),
      rows: Object.freeze(filteredRows),
      metadata: input.data.metadata,
    });
    const afterRows = transformedData.rows.map((row) => row.cells);

    return Object.freeze({
      data: transformedData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt,
      }),
      filtering: Object.freeze({
        filteredAt: executedAt,
        mode: config.mode,
        logicalOperator: config.logicalOperator,
        conditionCount: conditions.length,
        totalRows: rows.length,
        includedRows: filteredRows.length,
        excludedRows: excludedRowIds.size,
        groupMatchedRows,
        conditions: conditionResults,
      }),
      sampleRows: toSampleRows(transformedData, config.previewSampleSize),
      preview: Object.freeze({
        rowDeltas: buildPreviewRowDeltas({
          beforeRows,
          afterRows,
          rowIds: input.data.rows.map((row) => row.rowId),
          afterRowIds: transformedData.rows.map((row) => row.rowId),
          targetFields: Object.freeze([...new Set(conditions.map((condition) => condition.fieldName))]),
          droppedRowIds: excludedRowIds,
          sampleSize: config.previewSampleSize,
        }),
        includedRows: Object.freeze(rows
          .filter((row) => includedRowIds.has(row.rowId))
          .slice(0, config.previewSampleSize)
          .map((row) => Object.freeze({ rowId: row.rowId, fields: row.fields }))),
        excludedRows: Object.freeze(rows
          .filter((row) => excludedRowIds.has(row.rowId))
          .slice(0, config.previewSampleSize)
          .map((row) => Object.freeze({ rowId: row.rowId, fields: row.fields }))),
        appliedConditions: conditionResults,
      }),
    });
  }
}
