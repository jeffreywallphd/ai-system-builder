import { z } from "zod";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalTableRow,
} from "../../../../../../domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import { isMissingValue } from "../MissingValueUtils";
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

const CanonicalRecordValueSchema: z.ZodType<CanonicalRecordValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(CanonicalRecordValueSchema),
  z.record(CanonicalRecordValueSchema),
]));

export const MissingValueStrategies = Object.freeze({
  leave: "leave",
  fillDefault: "fill-default",
  fillPerField: "fill-per-field",
  dropRow: "drop-row",
} as const);

export const MissingValuePerFieldOverrideStrategies = Object.freeze({
  leave: "leave",
  fillConstant: "fill-constant",
} as const);

export const MissingValueRowDropModes = Object.freeze({
  any: "any",
  all: "all",
} as const);

export type MissingValueStrategy = typeof MissingValueStrategies[keyof typeof MissingValueStrategies];
export type MissingValueRowDropMode = typeof MissingValueRowDropModes[keyof typeof MissingValueRowDropModes];

const MissingValuePerFieldOverrideSchema = z.object({
  fieldName: z.string().trim().min(1),
  strategy: z.enum([
    MissingValuePerFieldOverrideStrategies.leave,
    MissingValuePerFieldOverrideStrategies.fillConstant,
  ]),
  fillValue: CanonicalRecordValueSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.strategy === MissingValuePerFieldOverrideStrategies.fillConstant && value.fillValue === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fillValue"],
      message: "Per-field fill-constant overrides require fillValue.",
    });
  }
});

export const MissingValueHandlingConfigSchema = z.object({
  targetFields: z.array(z.string().trim().min(1)).default([]),
  strategy: z.enum([
    MissingValueStrategies.leave,
    MissingValueStrategies.fillDefault,
    MissingValueStrategies.fillPerField,
    MissingValueStrategies.dropRow,
  ]).default(MissingValueStrategies.leave),
  defaultFillValue: CanonicalRecordValueSchema.default(null),
  perFieldFillValues: z.record(CanonicalRecordValueSchema).default({}),
  perFieldOverrides: z.array(MissingValuePerFieldOverrideSchema).default([]),
  treatEmptyStringAsMissing: z.boolean().default(true),
  treatWhitespaceAsMissing: z.boolean().default(false),
  rowDropMode: z.enum([MissingValueRowDropModes.any, MissingValueRowDropModes.all]).default(MissingValueRowDropModes.any),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seenTargets = new Set<string>();
  value.targetFields.forEach((field, index) => {
    if (seenTargets.has(field)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetFields", index],
        message: `Duplicate target field '${field}' is not allowed.`,
      });
    }
    seenTargets.add(field);
  });

  const seenOverrides = new Set<string>();
  value.perFieldOverrides.forEach((override, index) => {
    if (seenOverrides.has(override.fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["perFieldOverrides", index, "fieldName"],
        message: `Duplicate per-field override for '${override.fieldName}' is not allowed.`,
      });
    }
    seenOverrides.add(override.fieldName);
  });
});

export type MissingValueHandlingConfig = z.output<typeof MissingValueHandlingConfigSchema>;

export interface MissingValueFieldOutcome {
  readonly fieldName: string;
  readonly strategy: string;
  readonly missingCount: number;
  readonly filledCount: number;
  readonly leftMissingCount: number;
}

export interface MissingValueHandlingOutput extends ITransformationOutput {
  readonly missingValueHandling: {
    readonly handledAt: string;
    readonly strategy: MissingValueStrategy;
    readonly rowDropMode: MissingValueRowDropMode;
    readonly targetFields: ReadonlyArray<string>;
    readonly treatEmptyStringAsMissing: boolean;
    readonly treatWhitespaceAsMissing: boolean;
    readonly rowsChanged: number;
    readonly rowsDropped: number;
    readonly valuesFilled: number;
    readonly fields: ReadonlyArray<MissingValueFieldOutcome>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly targetFields: ReadonlyArray<string>;
    readonly rowDeltas: ReadonlyArray<TransformationPreviewRowDelta>;
  };
}

const MissingValueHandlingOutputSchema: z.ZodType<MissingValueHandlingOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  missingValueHandling: z.object({
    handledAt: z.string().min(1),
    strategy: z.enum([
      MissingValueStrategies.leave,
      MissingValueStrategies.fillDefault,
      MissingValueStrategies.fillPerField,
      MissingValueStrategies.dropRow,
    ]),
    rowDropMode: z.enum([MissingValueRowDropModes.any, MissingValueRowDropModes.all]),
    targetFields: z.array(z.string().min(1)),
    treatEmptyStringAsMissing: z.boolean(),
    treatWhitespaceAsMissing: z.boolean(),
    rowsChanged: z.number().int().nonnegative(),
    rowsDropped: z.number().int().nonnegative(),
    valuesFilled: z.number().int().nonnegative(),
    fields: z.array(z.object({
      fieldName: z.string().min(1),
      strategy: z.string().min(1),
      missingCount: z.number().int().nonnegative(),
      filledCount: z.number().int().nonnegative(),
      leftMissingCount: z.number().int().nonnegative(),
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
  }),
});

interface MutableFieldOutcome {
  readonly fieldName: string;
  strategy: string;
  missingCount: number;
  filledCount: number;
  leftMissingCount: number;
}

function collectRows(data: ITransformationInput["data"]): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === TransformationInputDataKinds.records) {
    return data.records.map((record) => record.fields);
  }
  return data.rows.map((row) => row.cells);
}

function collectFieldNames(rows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>): ReadonlyArray<string> {
  const names = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((name) => names.add(name));
  }
  return Object.freeze([...names].sort((left, right) => left.localeCompare(right)));
}

function resolveTargetFields(
  config: MissingValueHandlingConfig,
  allFields: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (config.targetFields.length > 0) {
    return Object.freeze([...config.targetFields]);
  }
  return allFields;
}

function createFieldOutcomeMap(targetFields: ReadonlyArray<string>): Map<string, MutableFieldOutcome> {
  const map = new Map<string, MutableFieldOutcome>();
  targetFields.forEach((fieldName) => {
    map.set(fieldName, {
      fieldName,
      strategy: MissingValueStrategies.leave,
      missingCount: 0,
      filledCount: 0,
      leftMissingCount: 0,
    });
  });
  return map;
}

function resolveFieldAction(
  fieldName: string,
  config: MissingValueHandlingConfig,
): Readonly<{ action: "leave" | "fill" | "drop-check"; fillValue?: CanonicalRecordValue; strategyLabel: string }> {
  const override = config.perFieldOverrides.find((entry) => entry.fieldName === fieldName);
  if (override?.strategy === MissingValuePerFieldOverrideStrategies.leave) {
    return Object.freeze({ action: "leave", strategyLabel: MissingValuePerFieldOverrideStrategies.leave });
  }
  if (override?.strategy === MissingValuePerFieldOverrideStrategies.fillConstant) {
    return Object.freeze({
      action: "fill",
      fillValue: override.fillValue,
      strategyLabel: MissingValuePerFieldOverrideStrategies.fillConstant,
    });
  }

  if (config.strategy === MissingValueStrategies.fillDefault) {
    return Object.freeze({
      action: "fill",
      fillValue: config.defaultFillValue,
      strategyLabel: MissingValueStrategies.fillDefault,
    });
  }

  if (config.strategy === MissingValueStrategies.fillPerField) {
    if (fieldName in config.perFieldFillValues) {
      return Object.freeze({
        action: "fill",
        fillValue: config.perFieldFillValues[fieldName],
        strategyLabel: MissingValueStrategies.fillPerField,
      });
    }
    return Object.freeze({ action: "leave", strategyLabel: MissingValueStrategies.fillPerField });
  }

  if (config.strategy === MissingValueStrategies.dropRow) {
    return Object.freeze({ action: "drop-check", strategyLabel: MissingValueStrategies.dropRow });
  }

  return Object.freeze({ action: "leave", strategyLabel: MissingValueStrategies.leave });
}

function toSampleRows(data: ITransformationInput["data"], previewSampleSize: number): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  const rows = collectRows(data);
  return Object.freeze(rows.slice(0, previewSampleSize));
}

function computeDropDecision(missingFlags: ReadonlyArray<boolean>, rowDropMode: MissingValueRowDropMode): boolean {
  if (missingFlags.length === 0) {
    return false;
  }
  if (rowDropMode === MissingValueRowDropModes.all) {
    return missingFlags.every(Boolean);
  }
  return missingFlags.some(Boolean);
}

export class MissingValueHandlingAsset extends BaseTransformationAsset<
  ITransformationInput,
  MissingValueHandlingOutput,
  MissingValueHandlingConfig
> {
  public static readonly assetId = "missing-value-handling";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: MissingValueHandlingAsset.assetId,
      name: "Missing Value Handling",
      description: "Applies deterministic missing-value cleanup strategies for canonical records/table data.",
      version: MissingValueHandlingAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: MissingValueHandlingOutputSchema,
      configSchema: MissingValueHandlingConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: MissingValueHandlingConfig): Promise<MissingValueHandlingOutput> {
    const beforeRows = collectRows(input.data);
    const allFields = collectFieldNames(beforeRows);
    const targetFields = resolveTargetFields(config, allFields);
    const fieldOutcomeMap = createFieldOutcomeMap(targetFields);
    const droppedRowIds = new Set<string>();

    let rowsChanged = 0;
    let rowsDropped = 0;
    let valuesFilled = 0;

    if (input.data.kind === TransformationInputDataKinds.records) {
      const transformedRecords: CanonicalRecordItem[] = [];
      for (const record of input.data.records) {
        const updatedFields: Record<string, CanonicalRecordValue> = { ...record.fields };
        let changed = false;

        for (const fieldName of targetFields) {
          const value = updatedFields[fieldName];
          const missing = isMissingValue(value, {
            treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
            treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
          });
          const outcome = fieldOutcomeMap.get(fieldName);
          if (!outcome) {
            continue;
          }

          const action = resolveFieldAction(fieldName, config);
          outcome.strategy = action.strategyLabel;

          if (!missing) {
            continue;
          }

          outcome.missingCount += 1;
          if (action.action === "fill") {
            updatedFields[fieldName] = action.fillValue ?? null;
            outcome.filledCount += 1;
            valuesFilled += 1;
            changed = true;
            continue;
          }

          if (action.action === "drop-check") {
            continue;
          }

          outcome.leftMissingCount += 1;
        }

        if (config.strategy === MissingValueStrategies.dropRow) {
          const missingFlags = targetFields.map((fieldName) => {
            const value = updatedFields[fieldName];
            return isMissingValue(value, {
              treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
              treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
            });
          });
          if (computeDropDecision(missingFlags, config.rowDropMode)) {
            droppedRowIds.add(record.recordId);
            rowsDropped += 1;
            continue;
          }
        }

        if (changed) {
          rowsChanged += 1;
        }

        transformedRecords.push(Object.freeze({
          ...record,
          fields: Object.freeze(updatedFields),
        }));
      }

      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(transformedRecords),
        metadata: input.data.metadata,
      });
      const afterRows = collectRows(transformedData);
      const fieldOutcomes = Object.freeze([...fieldOutcomeMap.values()].map((entry) => Object.freeze({ ...entry } satisfies MissingValueFieldOutcome)));

      return Object.freeze({
        data: transformedData,
        metadata: Object.freeze({
          assetId: this.id,
          assetVersion: this.version,
          executedAt: new Date().toISOString(),
        }),
        missingValueHandling: Object.freeze({
          handledAt: new Date().toISOString(),
          strategy: config.strategy,
          rowDropMode: config.rowDropMode,
          targetFields,
          treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
          treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
          rowsChanged,
          rowsDropped,
          valuesFilled,
          fields: fieldOutcomes,
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
            droppedRowIds,
            sampleSize: config.previewSampleSize,
          }),
        }),
      });
    }

    const transformedRows: CanonicalTableRow[] = [];
    for (const row of input.data.rows) {
      const updatedCells: Record<string, CanonicalRecordValue> = { ...row.cells };
      let changed = false;

      for (const fieldName of targetFields) {
        const outcome = fieldOutcomeMap.get(fieldName);
        if (!outcome) {
          continue;
        }

        const action = resolveFieldAction(fieldName, config);
        outcome.strategy = action.strategyLabel;
        const currentValue = updatedCells[fieldName];
        const missing = isMissingValue(currentValue, {
          treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
          treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
        });

        if (!missing) {
          continue;
        }

        outcome.missingCount += 1;
        if (action.action === "fill") {
          updatedCells[fieldName] = action.fillValue ?? null;
          outcome.filledCount += 1;
          valuesFilled += 1;
          changed = true;
          continue;
        }

        if (action.action === "leave") {
          outcome.leftMissingCount += 1;
        }
      }

      if (config.strategy === MissingValueStrategies.dropRow) {
        const missingFlags = targetFields.map((fieldName) => {
          const value = updatedCells[fieldName];
          return isMissingValue(value, {
            treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
            treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
          });
        });
        if (computeDropDecision(missingFlags, config.rowDropMode)) {
          droppedRowIds.add(row.rowId);
          rowsDropped += 1;
          continue;
        }
      }

      if (changed) {
        rowsChanged += 1;
      }

      transformedRows.push(Object.freeze({
        ...row,
        cells: Object.freeze(updatedCells),
      }));
    }

    const transformedData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, transformedRows),
      rows: Object.freeze(transformedRows),
      metadata: input.data.metadata,
    });
    const afterRows = collectRows(transformedData);
    const fieldOutcomes = Object.freeze([...fieldOutcomeMap.values()].map((entry) => Object.freeze({ ...entry } satisfies MissingValueFieldOutcome)));

    return Object.freeze({
      data: transformedData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt: new Date().toISOString(),
      }),
      missingValueHandling: Object.freeze({
        handledAt: new Date().toISOString(),
        strategy: config.strategy,
        rowDropMode: config.rowDropMode,
        targetFields,
        treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
        treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
        rowsChanged,
        rowsDropped,
        valuesFilled,
        fields: fieldOutcomes,
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
          droppedRowIds,
          sampleSize: config.previewSampleSize,
        }),
      }),
    });
  }
}
