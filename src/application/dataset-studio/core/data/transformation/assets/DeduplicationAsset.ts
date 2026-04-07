import { z } from "zod";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalTableRow,
} from "@domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import {
  findExactDuplicateGroupsByAllFields,
  findExactDuplicateGroupsByFields,
  findFuzzyDuplicateGroupsByFields,
  type DeduplicationComparableRow,
  type DeduplicationGroup,
} from "../DeduplicationUtils";
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

export const DeduplicationModes = Object.freeze({
  exactAll: "exact-all",
  exactFields: "exact-fields",
  fuzzyFields: "fuzzy-fields",
} as const);

export const DeduplicationKeepStrategies = Object.freeze({
  first: "keep-first",
  last: "keep-last",
  best: "keep-best",
} as const);

export const DeduplicationPriorityDirections = Object.freeze({
  ascending: "ascending",
  descending: "descending",
} as const);

export type DeduplicationMode = typeof DeduplicationModes[keyof typeof DeduplicationModes];
export type DeduplicationKeepStrategy = typeof DeduplicationKeepStrategies[keyof typeof DeduplicationKeepStrategies];

const DeduplicationPriorityRuleSchema = z.object({
  fieldName: z.string().trim().min(1),
  direction: z.enum([DeduplicationPriorityDirections.ascending, DeduplicationPriorityDirections.descending]).default(DeduplicationPriorityDirections.ascending),
});

export const DeduplicationConfigSchema = z.object({
  mode: z.enum([
    DeduplicationModes.exactAll,
    DeduplicationModes.exactFields,
    DeduplicationModes.fuzzyFields,
  ]).default(DeduplicationModes.exactAll),
  targetFields: z.array(z.string().trim().min(1)).default([]),
  maxDistance: z.number().int().min(0).max(10).default(1),
  caseSensitive: z.boolean().default(false),
  trimStrings: z.boolean().default(true),
  treatMissingAsNull: z.boolean().default(true),
  keepStrategy: z.enum([
    DeduplicationKeepStrategies.first,
    DeduplicationKeepStrategies.last,
    DeduplicationKeepStrategies.best,
  ]).default(DeduplicationKeepStrategies.first),
  priorityRules: z.array(DeduplicationPriorityRuleSchema).default([]),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seenTargets = new Set<string>();
  value.targetFields.forEach((fieldName, index) => {
    if (seenTargets.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetFields", index],
        message: `Duplicate target field '${fieldName}' is not allowed.`,
      });
    }
    seenTargets.add(fieldName);
  });

  const seenPriority = new Set<string>();
  value.priorityRules.forEach((rule, index) => {
    if (seenPriority.has(rule.fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priorityRules", index, "fieldName"],
        message: `Duplicate priority rule for '${rule.fieldName}' is not allowed.`,
      });
    }
    seenPriority.add(rule.fieldName);
  });

  if (value.mode !== DeduplicationModes.exactAll && value.targetFields.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetFields"],
      message: `Deduplication mode '${value.mode}' requires at least one target field.`,
    });
  }
  if (value.mode === DeduplicationModes.fuzzyFields && value.maxDistance < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxDistance"],
      message: "Fuzzy-field deduplication requires maxDistance to be at least 1.",
    });
  }
  if (value.keepStrategy === DeduplicationKeepStrategies.best && value.priorityRules.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["priorityRules"],
      message: "keep-best strategy requires at least one priority rule.",
    });
  }
});

export type DeduplicationConfig = z.output<typeof DeduplicationConfigSchema>;

export interface DeduplicationGroupResult {
  readonly groupId: string;
  readonly rowIds: ReadonlyArray<string>;
  readonly retainedRowId: string;
  readonly removedRowIds: ReadonlyArray<string>;
  readonly confidence?: number;
  readonly pairDistances: ReadonlyArray<Readonly<{ fieldName: string; distance: number; confidence: number }>>;
}

export interface DeduplicationOutput extends ITransformationOutput {
  readonly deduplication: {
    readonly deduplicatedAt: string;
    readonly mode: DeduplicationMode;
    readonly keepStrategy: DeduplicationKeepStrategy;
    readonly targetFields: ReadonlyArray<string>;
    readonly maxDistance: number;
    readonly totalRows: number;
    readonly deduplicatedRows: number;
    readonly removedRows: number;
    readonly duplicateGroupCount: number;
    readonly duplicateGroups: ReadonlyArray<DeduplicationGroupResult>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly targetFields: ReadonlyArray<string>;
    readonly rowDeltas: ReadonlyArray<TransformationPreviewRowDelta>;
    readonly groups: ReadonlyArray<DeduplicationGroupResult>;
  };
}

const DeduplicationOutputSchema: z.ZodType<DeduplicationOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  deduplication: z.object({
    deduplicatedAt: z.string().min(1),
    mode: z.enum([
      DeduplicationModes.exactAll,
      DeduplicationModes.exactFields,
      DeduplicationModes.fuzzyFields,
    ]),
    keepStrategy: z.enum([
      DeduplicationKeepStrategies.first,
      DeduplicationKeepStrategies.last,
      DeduplicationKeepStrategies.best,
    ]),
    targetFields: z.array(z.string().min(1)),
    maxDistance: z.number().int().min(0),
    totalRows: z.number().int().nonnegative(),
    deduplicatedRows: z.number().int().nonnegative(),
    removedRows: z.number().int().nonnegative(),
    duplicateGroupCount: z.number().int().nonnegative(),
    duplicateGroups: z.array(z.object({
      groupId: z.string().min(1),
      rowIds: z.array(z.string().min(1)),
      retainedRowId: z.string().min(1),
      removedRowIds: z.array(z.string().min(1)),
      confidence: z.number().min(0).max(1).optional(),
      pairDistances: z.array(z.object({
        fieldName: z.string().min(1),
        distance: z.number().min(0),
        confidence: z.number().min(0).max(1),
      })),
    })),
  }),
  sampleRows: z.array(z.record(z.unknown())),
  preview: z.object({
    targetFields: z.array(z.string().min(1)),
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
    groups: z.array(z.object({
      groupId: z.string().min(1),
      rowIds: z.array(z.string().min(1)),
      retainedRowId: z.string().min(1),
      removedRowIds: z.array(z.string().min(1)),
      confidence: z.number().min(0).max(1).optional(),
      pairDistances: z.array(z.object({
        fieldName: z.string().min(1),
        distance: z.number().min(0),
        confidence: z.number().min(0).max(1),
      })),
    })),
  }),
});

interface ComparableRowsSnapshot {
  readonly rows: ReadonlyArray<DeduplicationComparableRow>;
  readonly fieldNames: ReadonlyArray<string>;
}

function toComparableRows(input: ITransformationInput["data"]): ComparableRowsSnapshot {
  if (input.kind === TransformationInputDataKinds.records) {
    const fieldNames = new Set<string>();
    const rows = input.records.map((record, rowIndex) => {
      Object.keys(record.fields).forEach((fieldName) => fieldNames.add(fieldName));
      return Object.freeze({
        rowId: record.recordId,
        rowIndex,
        fields: record.fields,
      } satisfies DeduplicationComparableRow);
    });
    return Object.freeze({
      rows: Object.freeze(rows),
      fieldNames: Object.freeze([...fieldNames].sort((left, right) => left.localeCompare(right))),
    });
  }

  const fieldNames = new Set<string>();
  const rows = input.rows.map((row, rowIndex) => {
    Object.keys(row.cells).forEach((fieldName) => fieldNames.add(fieldName));
    return Object.freeze({
      rowId: row.rowId,
      rowIndex,
      fields: row.cells,
    } satisfies DeduplicationComparableRow);
  });
  return Object.freeze({
    rows: Object.freeze(rows),
    fieldNames: Object.freeze([...fieldNames].sort((left, right) => left.localeCompare(right))),
  });
}

function selectRetainedRowIndex(
  group: DeduplicationGroup,
  rows: ReadonlyArray<DeduplicationComparableRow>,
  config: DeduplicationConfig,
): number {
  if (config.keepStrategy === DeduplicationKeepStrategies.first) {
    return group.rowIndexes[0]!;
  }
  if (config.keepStrategy === DeduplicationKeepStrategies.last) {
    return group.rowIndexes[group.rowIndexes.length - 1]!;
  }

  const sorted = [...group.rowIndexes].sort((leftIndex, rightIndex) => {
    const leftRow = rows[leftIndex]!;
    const rightRow = rows[rightIndex]!;
    for (const rule of config.priorityRules) {
      const leftValue = leftRow.fields[rule.fieldName];
      const rightValue = rightRow.fields[rule.fieldName];
      const leftKey = JSON.stringify(leftValue ?? null);
      const rightKey = JSON.stringify(rightValue ?? null);
      if (leftKey === rightKey) {
        continue;
      }
      const compared = leftKey.localeCompare(rightKey);
      return rule.direction === DeduplicationPriorityDirections.ascending ? compared : -compared;
    }
    return leftIndex - rightIndex;
  });
  return sorted[0] ?? group.rowIndexes[0]!;
}

function toGroupResult(
  group: DeduplicationGroup,
  rows: ReadonlyArray<DeduplicationComparableRow>,
  retainedIndex: number,
): DeduplicationGroupResult {
  const retainedRowId = rows[retainedIndex]!.rowId;
  const removedRowIds = group.rowIndexes
    .filter((rowIndex) => rowIndex !== retainedIndex)
    .map((rowIndex) => rows[rowIndex]!.rowId);

  const confidence = group.pairDistances.length === 0
    ? undefined
    : group.pairDistances.reduce((sum, pair) => sum + pair.confidence, 0) / group.pairDistances.length;

  return Object.freeze({
    groupId: group.groupId,
    rowIds: group.rowIds,
    retainedRowId,
    removedRowIds: Object.freeze(removedRowIds),
    confidence,
    pairDistances: Object.freeze(group.pairDistances.map((pair) => Object.freeze({
      fieldName: pair.fieldName,
      distance: pair.distance,
      confidence: pair.confidence,
    }))),
  });
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

export class DeduplicationAsset extends BaseTransformationAsset<
  ITransformationInput,
  DeduplicationOutput,
  DeduplicationConfig
> {
  public static readonly assetId = "deduplication";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: DeduplicationAsset.assetId,
      name: "Deduplication",
      description: "Detects duplicate canonical records/table rows with deterministic retention strategies.",
      version: DeduplicationAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: DeduplicationOutputSchema,
      configSchema: DeduplicationConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: DeduplicationConfig): Promise<DeduplicationOutput> {
    const snapshot = toComparableRows(input.data);
    const targetFields = config.mode === DeduplicationModes.exactAll
      ? snapshot.fieldNames
      : Object.freeze([...config.targetFields]);
    const comparisonOptions = Object.freeze({
      caseSensitive: config.caseSensitive,
      trimStrings: config.trimStrings,
      treatMissingAsNull: config.treatMissingAsNull,
    });

    const duplicateGroups = config.mode === DeduplicationModes.exactAll
      ? findExactDuplicateGroupsByAllFields(snapshot.rows, comparisonOptions)
      : config.mode === DeduplicationModes.exactFields
        ? findExactDuplicateGroupsByFields(snapshot.rows, targetFields, comparisonOptions)
        : findFuzzyDuplicateGroupsByFields(snapshot.rows, targetFields, comparisonOptions, config.maxDistance);

    const removedRowIds = new Set<string>();
    const groupResults = duplicateGroups.map((group) => {
      const retainedIndex = selectRetainedRowIndex(group, snapshot.rows, config);
      group.rowIndexes
        .filter((index) => index !== retainedIndex)
        .forEach((index) => removedRowIds.add(snapshot.rows[index]!.rowId));
      return toGroupResult(group, snapshot.rows, retainedIndex);
    });

    const beforeRows = snapshot.rows.map((row) => row.fields);
    const executedAt = new Date().toISOString();

    if (input.data.kind === TransformationInputDataKinds.records) {
      const deduplicatedRecords = input.data.records.filter((record) => !removedRowIds.has(record.recordId));
      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(deduplicatedRecords.map((record) => Object.freeze({ ...record } satisfies CanonicalRecordItem))),
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
        deduplication: Object.freeze({
          deduplicatedAt: executedAt,
          mode: config.mode,
          keepStrategy: config.keepStrategy,
          targetFields,
          maxDistance: config.maxDistance,
          totalRows: input.data.records.length,
          deduplicatedRows: transformedData.records.length,
          removedRows: removedRowIds.size,
          duplicateGroupCount: groupResults.length,
          duplicateGroups: Object.freeze(groupResults),
        }),
        sampleRows: toSampleRows(transformedData, config.previewSampleSize),
        preview: Object.freeze({
          targetFields,
          rowDeltas: buildPreviewRowDeltas({
            beforeRows,
            afterRows,
            rowIds: input.data.records.map((record) => record.recordId),
            afterRowIds: transformedData.records.map((record) => record.recordId),
            targetFields,
            droppedRowIds: removedRowIds,
            sampleSize: config.previewSampleSize,
          }),
          groups: Object.freeze(groupResults.slice(0, config.previewSampleSize)),
        }),
      });
    }

    const deduplicatedRows = input.data.rows.filter((row) => !removedRowIds.has(row.rowId));
    const transformedData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, deduplicatedRows),
      rows: Object.freeze(deduplicatedRows.map((row) => Object.freeze({ ...row } satisfies CanonicalTableRow))),
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
      deduplication: Object.freeze({
        deduplicatedAt: executedAt,
        mode: config.mode,
        keepStrategy: config.keepStrategy,
        targetFields,
        maxDistance: config.maxDistance,
        totalRows: input.data.rows.length,
        deduplicatedRows: transformedData.rows.length,
        removedRows: removedRowIds.size,
        duplicateGroupCount: groupResults.length,
        duplicateGroups: Object.freeze(groupResults),
      }),
      sampleRows: toSampleRows(transformedData, config.previewSampleSize),
      preview: Object.freeze({
        targetFields,
        rowDeltas: buildPreviewRowDeltas({
          beforeRows,
          afterRows,
          rowIds: input.data.rows.map((row) => row.rowId),
          afterRowIds: transformedData.rows.map((row) => row.rowId),
          targetFields,
          droppedRowIds: removedRowIds,
          sampleSize: config.previewSampleSize,
        }),
        groups: Object.freeze(groupResults.slice(0, config.previewSampleSize)),
      }),
    });
  }
}

