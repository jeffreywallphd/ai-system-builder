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
  TransformationInputDataKinds,
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";
import {
  buildPreviewRowDeltas,
  rebuildTableColumnsFromRows,
  type TransformationPreviewRowDelta,
} from "../TransformationPreviewUtils";
import {
  coerceValueToType,
  TypeNormalizationFailureStrategies,
  TypeNormalizationTargetTypes,
  type TypeNormalizationFailureStrategy,
  type TypeNormalizationTargetType,
} from "../TypeNormalizationCoercion";

const TypeNormalizationFieldRuleSchema = z.object({
  fieldName: z.string().trim().min(1),
  targetType: z.enum([
    TypeNormalizationTargetTypes.string,
    TypeNormalizationTargetTypes.number,
    TypeNormalizationTargetTypes.boolean,
    TypeNormalizationTargetTypes.date,
  ]),
});

export const TypeNormalizationConfigSchema = z.object({
  fieldRules: z.array(TypeNormalizationFieldRuleSchema).default([]),
  inferredFieldTypes: z.record(z.enum([
    TypeNormalizationTargetTypes.string,
    TypeNormalizationTargetTypes.number,
    TypeNormalizationTargetTypes.boolean,
    TypeNormalizationTargetTypes.date,
  ])).default({}),
  trimStrings: z.boolean().default(true),
  emptyStringAsNull: z.boolean().default(false),
  onConversionFailure: z.enum([
    TypeNormalizationFailureStrategies.preserve,
    TypeNormalizationFailureStrategies.setNull,
  ]).default(TypeNormalizationFailureStrategies.preserve),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.fieldRules.length; index += 1) {
    const field = value.fieldRules[index];
    if (!field) {
      continue;
    }
    if (seen.has(field.fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldRules", index, "fieldName"],
        message: `Duplicate normalization field '${field.fieldName}' is not allowed.`,
      });
    }
    seen.add(field.fieldName);
  }
});

export type TypeNormalizationConfig = z.output<typeof TypeNormalizationConfigSchema>;

export interface TypeNormalizationFieldOutcome {
  readonly fieldName: string;
  readonly targetType: TypeNormalizationTargetType;
  readonly attemptedCount: number;
  readonly convertedCount: number;
  readonly unchangedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
}

export interface TypeNormalizationOutput extends ITransformationOutput {
  readonly normalization: {
    readonly normalizedAt: string;
    readonly trimStrings: boolean;
    readonly emptyStringAsNull: boolean;
    readonly onConversionFailure: TypeNormalizationFailureStrategy;
    readonly targetedFields: ReadonlyArray<string>;
    readonly fields: ReadonlyArray<TypeNormalizationFieldOutcome>;
    readonly totals: {
      readonly attemptedCount: number;
      readonly convertedCount: number;
      readonly failedCount: number;
      readonly skippedCount: number;
    };
    readonly skippedFields: ReadonlyArray<string>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly targetedFields: ReadonlyArray<string>;
    readonly rowDeltas: ReadonlyArray<TransformationPreviewRowDelta>;
  };
}

const TypeNormalizationOutputSchema: z.ZodType<TypeNormalizationOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  normalization: z.object({
    normalizedAt: z.string().min(1),
    trimStrings: z.boolean(),
    emptyStringAsNull: z.boolean(),
    onConversionFailure: z.enum([
      TypeNormalizationFailureStrategies.preserve,
      TypeNormalizationFailureStrategies.setNull,
    ]),
    targetedFields: z.array(z.string().min(1)),
    fields: z.array(z.object({
      fieldName: z.string().min(1),
      targetType: z.enum([
        TypeNormalizationTargetTypes.string,
        TypeNormalizationTargetTypes.number,
        TypeNormalizationTargetTypes.boolean,
        TypeNormalizationTargetTypes.date,
      ]),
      attemptedCount: z.number().int().nonnegative(),
      convertedCount: z.number().int().nonnegative(),
      unchangedCount: z.number().int().nonnegative(),
      failedCount: z.number().int().nonnegative(),
      skippedCount: z.number().int().nonnegative(),
    })),
    totals: z.object({
      attemptedCount: z.number().int().nonnegative(),
      convertedCount: z.number().int().nonnegative(),
      failedCount: z.number().int().nonnegative(),
      skippedCount: z.number().int().nonnegative(),
    }),
    skippedFields: z.array(z.string().min(1)),
  }),
  sampleRows: z.array(z.record(z.unknown())),
  preview: z.object({
    targetedFields: z.array(z.string().min(1)),
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
  readonly targetType: TypeNormalizationTargetType;
  attemptedCount: number;
  convertedCount: number;
  unchangedCount: number;
  failedCount: number;
  skippedCount: number;
}

function toFieldTypeMap(config: TypeNormalizationConfig): ReadonlyMap<string, TypeNormalizationTargetType> {
  const result = new Map<string, TypeNormalizationTargetType>();
  for (const [fieldName, targetType] of Object.entries(config.inferredFieldTypes)) {
    result.set(fieldName, targetType);
  }
  for (const entry of config.fieldRules) {
    result.set(entry.fieldName, entry.targetType);
  }
  return result;
}

function collectRows(data: ITransformationInput["data"]): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === TransformationInputDataKinds.records) {
    return data.records.map((record) => record.fields);
  }
  return data.rows.map((row) => row.cells);
}

function createFieldOutcomes(targetMap: ReadonlyMap<string, TypeNormalizationTargetType>): Map<string, MutableFieldOutcome> {
  const result = new Map<string, MutableFieldOutcome>();
  for (const [fieldName, targetType] of [...targetMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    result.set(fieldName, {
      fieldName,
      targetType,
      attemptedCount: 0,
      convertedCount: 0,
      unchangedCount: 0,
      failedCount: 0,
      skippedCount: 0,
    });
  }
  return result;
}

function applyNormalization(
  fields: Readonly<Record<string, CanonicalRecordValue>>,
  targetMap: ReadonlyMap<string, TypeNormalizationTargetType>,
  config: TypeNormalizationConfig,
  outcomes: Map<string, MutableFieldOutcome>,
): Readonly<Record<string, CanonicalRecordValue>> {
  const transformed: Record<string, CanonicalRecordValue> = { ...fields };

  for (const [fieldName, targetType] of targetMap.entries()) {
    if (!(fieldName in fields)) {
      continue;
    }

    const outcome = outcomes.get(fieldName);
    if (!outcome) {
      continue;
    }

    outcome.attemptedCount += 1;
    const coercion = coerceValueToType({
      value: fields[fieldName],
      targetType,
      trimStrings: config.trimStrings,
      emptyStringAsNull: config.emptyStringAsNull,
      onFailure: config.onConversionFailure,
    });

    if (coercion.status === "converted") {
      outcome.convertedCount += 1;
      if (coercion.value === undefined) {
        delete transformed[fieldName];
      } else {
        transformed[fieldName] = coercion.value;
      }
      continue;
    }

    if (coercion.status === "unchanged") {
      outcome.unchangedCount += 1;
      continue;
    }

    if (coercion.status === "failed") {
      outcome.failedCount += 1;
      if (coercion.value === undefined) {
        delete transformed[fieldName];
      } else {
        transformed[fieldName] = coercion.value;
      }
      continue;
    }

    outcome.skippedCount += 1;
  }

  return Object.freeze(transformed);
}

function toSampleRows(data: ITransformationInput["data"], previewSampleSize: number): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  const rows = collectRows(data);
  return Object.freeze(rows.slice(0, previewSampleSize));
}

export class TypeNormalizationAsset extends BaseTransformationAsset<
  ITransformationInput,
  TypeNormalizationOutput,
  TypeNormalizationConfig
> {
  public static readonly assetId = "type-normalization";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: TypeNormalizationAsset.assetId,
      name: "Type Normalization",
      description: "Normalizes canonical field values into deterministic primitive types for downstream cleaning and transformations.",
      version: TypeNormalizationAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: TypeNormalizationOutputSchema,
      configSchema: TypeNormalizationConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: TypeNormalizationConfig): Promise<TypeNormalizationOutput> {
    const fieldTargetMap = toFieldTypeMap(config);
    const outcomes = createFieldOutcomes(fieldTargetMap);
    const beforeRows = collectRows(input.data);

    if (input.data.kind === TransformationInputDataKinds.records) {
      const normalizedRecords = input.data.records.map((record) => Object.freeze({
        ...record,
        fields: applyNormalization(record.fields, fieldTargetMap, config, outcomes),
      } satisfies CanonicalRecordItem));

      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(normalizedRecords),
        metadata: input.data.metadata,
      });
      const afterRows = collectRows(transformedData);

      const fields = Object.freeze([...outcomes.values()].map((entry) => Object.freeze({ ...entry } satisfies TypeNormalizationFieldOutcome)));
      const totals = Object.freeze({
        attemptedCount: fields.reduce((total, field) => total + field.attemptedCount, 0),
        convertedCount: fields.reduce((total, field) => total + field.convertedCount, 0),
        failedCount: fields.reduce((total, field) => total + field.failedCount, 0),
        skippedCount: fields.reduce((total, field) => total + field.skippedCount, 0),
      });

      return Object.freeze({
        data: transformedData,
        metadata: Object.freeze({
          assetId: this.id,
          assetVersion: this.version,
          executedAt: new Date().toISOString(),
        }),
        normalization: Object.freeze({
          normalizedAt: new Date().toISOString(),
          trimStrings: config.trimStrings,
          emptyStringAsNull: config.emptyStringAsNull,
          onConversionFailure: config.onConversionFailure,
          targetedFields: Object.freeze([...fieldTargetMap.keys()].sort((left, right) => left.localeCompare(right))),
          fields,
          totals,
          skippedFields: Object.freeze(fields.filter((field) => field.attemptedCount === 0).map((field) => field.fieldName)),
        }),
        sampleRows: toSampleRows(transformedData, config.previewSampleSize),
        preview: Object.freeze({
          targetedFields: Object.freeze([...fieldTargetMap.keys()].sort((left, right) => left.localeCompare(right))),
          rowDeltas: buildPreviewRowDeltas({
            beforeRows,
            afterRows,
            rowIds: input.data.records.map((record) => record.recordId),
            targetFields: Object.freeze([...fieldTargetMap.keys()]),
            sampleSize: config.previewSampleSize,
          }),
        }),
      });
    }

    const normalizedRows = input.data.rows.map((row) => Object.freeze({
      ...row,
      cells: applyNormalization(row.cells, fieldTargetMap, config, outcomes),
    } satisfies CanonicalTableRow));

    const transformedData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, normalizedRows),
      rows: Object.freeze(normalizedRows),
      metadata: input.data.metadata,
    });
    const afterRows = collectRows(transformedData);
    const fields = Object.freeze([...outcomes.values()].map((entry) => Object.freeze({ ...entry } satisfies TypeNormalizationFieldOutcome)));
    const totals = Object.freeze({
      attemptedCount: fields.reduce((total, field) => total + field.attemptedCount, 0),
      convertedCount: fields.reduce((total, field) => total + field.convertedCount, 0),
      failedCount: fields.reduce((total, field) => total + field.failedCount, 0),
      skippedCount: fields.reduce((total, field) => total + field.skippedCount, 0),
    });

    return Object.freeze({
      data: transformedData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt: new Date().toISOString(),
      }),
      normalization: Object.freeze({
        normalizedAt: new Date().toISOString(),
        trimStrings: config.trimStrings,
        emptyStringAsNull: config.emptyStringAsNull,
        onConversionFailure: config.onConversionFailure,
        targetedFields: Object.freeze([...fieldTargetMap.keys()].sort((left, right) => left.localeCompare(right))),
        fields,
        totals,
        skippedFields: Object.freeze(fields.filter((field) => field.attemptedCount === 0).map((field) => field.fieldName)),
      }),
      sampleRows: toSampleRows(transformedData, config.previewSampleSize),
      preview: Object.freeze({
        targetedFields: Object.freeze([...fieldTargetMap.keys()].sort((left, right) => left.localeCompare(right))),
        rowDeltas: buildPreviewRowDeltas({
          beforeRows,
          afterRows,
          rowIds: input.data.rows.map((row) => row.rowId),
          targetFields: Object.freeze([...fieldTargetMap.keys()]),
          sampleSize: config.previewSampleSize,
        }),
      }),
    });
  }
}
