import { z } from "zod";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalTableColumn,
  type CanonicalTableRow,
} from "@domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import {
  TransformationInputDataKinds,
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";

export interface FieldMappingDefinition {
  readonly sourceField: string;
  readonly targetField: string;
}

export const FieldMappingConfigSchema = z.object({
  mappings: z.array(z.object({
    sourceField: z.string().trim().min(1),
    targetField: z.string().trim().min(1),
  })).min(1),
  preserveUnmapped: z.boolean().default(true),
  dropEmptyTargets: z.boolean().default(false),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seenSource = new Set<string>();
  const seenTarget = new Set<string>();
  value.mappings.forEach((mapping, index) => {
    if (seenSource.has(mapping.sourceField)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mappings", index, "sourceField"],
        message: `Duplicate sourceField '${mapping.sourceField}' is not allowed.`,
      });
    }
    if (seenTarget.has(mapping.targetField)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mappings", index, "targetField"],
        message: `Duplicate targetField '${mapping.targetField}' is not allowed.`,
      });
    }
    seenSource.add(mapping.sourceField);
    seenTarget.add(mapping.targetField);
  });
});

export type FieldMappingConfig = z.output<typeof FieldMappingConfigSchema>;

export interface FieldMappingOutput extends ITransformationOutput {
  readonly mapping: {
    readonly mappedAt: string;
    readonly preserveUnmapped: boolean;
    readonly dropEmptyTargets: boolean;
    readonly appliedMappings: ReadonlyArray<FieldMappingDefinition>;
    readonly sourceFieldNames: ReadonlyArray<string>;
    readonly targetFieldNames: ReadonlyArray<string>;
    readonly unmappedSourceFieldNames: ReadonlyArray<string>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
}

const FieldMappingOutputSchema: z.ZodType<FieldMappingOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  mapping: z.object({
    mappedAt: z.string().min(1),
    preserveUnmapped: z.boolean(),
    dropEmptyTargets: z.boolean(),
    appliedMappings: z.array(z.object({
      sourceField: z.string().min(1),
      targetField: z.string().min(1),
    })),
    sourceFieldNames: z.array(z.string().min(1)),
    targetFieldNames: z.array(z.string().min(1)),
    unmappedSourceFieldNames: z.array(z.string().min(1)),
  }),
  sampleRows: z.array(z.record(z.unknown())),
});

function isEmptyTargetValue(value: CanonicalRecordValue | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return typeof value === "string" && value.trim().length === 0;
}

function collectRecordFieldNames(records: ReadonlyArray<CanonicalRecordItem>): ReadonlyArray<string> {
  const names = new Set<string>();
  for (const record of records) {
    for (const fieldName of Object.keys(record.fields)) {
      names.add(fieldName);
    }
  }
  return Object.freeze([...names].sort((left, right) => left.localeCompare(right)));
}

function collectRowFieldNames(rows: ReadonlyArray<CanonicalTableRow>): ReadonlyArray<string> {
  const names = new Set<string>();
  for (const row of rows) {
    for (const fieldName of Object.keys(row.cells)) {
      names.add(fieldName);
    }
  }
  return Object.freeze([...names].sort((left, right) => left.localeCompare(right)));
}

function collectSampleRows(
  data: ITransformationInput["data"],
  previewSampleSize: number,
): ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>> {
  if (data.kind === TransformationInputDataKinds.records) {
    return Object.freeze(data.records.slice(0, previewSampleSize).map((record) => record.fields));
  }
  return Object.freeze(data.rows.slice(0, previewSampleSize).map((row) => row.cells));
}

function transformFieldRecord(
  fields: Readonly<Record<string, CanonicalRecordValue>>,
  config: FieldMappingConfig,
): Readonly<Record<string, CanonicalRecordValue>> {
  const transformed: Record<string, CanonicalRecordValue> = {};
  const mappedSources = new Set(config.mappings.map((mapping) => mapping.sourceField));

  for (const mapping of config.mappings) {
    if (!(mapping.sourceField in fields)) {
      continue;
    }
    const value = fields[mapping.sourceField];
    if (config.dropEmptyTargets && isEmptyTargetValue(value)) {
      continue;
    }
    transformed[mapping.targetField] = value!;
  }

  if (config.preserveUnmapped) {
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!mappedSources.has(fieldName) && !(fieldName in transformed)) {
        transformed[fieldName] = value;
      }
    }
  }

  return Object.freeze(transformed);
}

function toColumnValueType(
  value: CanonicalRecordValue | undefined,
): CanonicalTableColumn["valueType"] {
  if (value === null || value === undefined) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

function buildMappedColumns(
  columns: ReadonlyArray<CanonicalTableColumn>,
  rows: ReadonlyArray<CanonicalTableRow>,
  transformedRows: ReadonlyArray<CanonicalTableRow>,
  config: FieldMappingConfig,
): ReadonlyArray<CanonicalTableColumn> {
  const sourceColumnsById = new Map(columns.map((column) => [column.columnId, column]));
  const mappedSourceIds = new Set(config.mappings.map((mapping) => mapping.sourceField));
  const mappedTargetIds = new Set(config.mappings.map((mapping) => mapping.targetField));
  const mappedColumns: CanonicalTableColumn[] = [];

  for (const mapping of config.mappings) {
    const sourceColumn = sourceColumnsById.get(mapping.sourceField);
    if (sourceColumn) {
      mappedColumns.push(Object.freeze({
        columnId: mapping.targetField,
        label: mapping.targetField,
        valueType: sourceColumn.valueType,
      }));
      continue;
    }

    const sourceValue = rows.find((row) => mapping.sourceField in row.cells)?.cells[mapping.sourceField];
    mappedColumns.push(Object.freeze({
      columnId: mapping.targetField,
      label: mapping.targetField,
      valueType: toColumnValueType(sourceValue),
    }));
  }

  if (config.preserveUnmapped) {
    for (const column of columns) {
      if (!mappedSourceIds.has(column.columnId) && !mappedTargetIds.has(column.columnId)) {
        mappedColumns.push(Object.freeze({ ...column }));
      }
    }
  }

  const seen = new Set<string>();
  const deduped: CanonicalTableColumn[] = [];
  for (const column of mappedColumns) {
    if (seen.has(column.columnId)) {
      continue;
    }
    seen.add(column.columnId);
    deduped.push(column);
  }

  for (const row of transformedRows) {
    for (const [fieldName, value] of Object.entries(row.cells)) {
      if (seen.has(fieldName)) {
        continue;
      }
      seen.add(fieldName);
      deduped.push(Object.freeze({
        columnId: fieldName,
        label: fieldName,
        valueType: toColumnValueType(value),
      }));
    }
  }

  return Object.freeze(deduped);
}

export class FieldMappingAsset extends BaseTransformationAsset<
  ITransformationInput,
  FieldMappingOutput,
  FieldMappingConfig
> {
  public static readonly assetId = "field-mapping";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: FieldMappingAsset.assetId,
      name: "Field Mapping",
      description: "Applies deterministic one-to-one field mapping and rename rules to canonical records/table inputs.",
      version: FieldMappingAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: FieldMappingOutputSchema,
      configSchema: FieldMappingConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: FieldMappingConfig): Promise<FieldMappingOutput> {
    if (input.data.kind === TransformationInputDataKinds.records) {
      const sourceFieldNames = collectRecordFieldNames(input.data.records);
      const mappedRecords = input.data.records.map((record) => Object.freeze({
        ...record,
        fields: transformFieldRecord(record.fields, config),
      } satisfies CanonicalRecordItem));
      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(mappedRecords),
        metadata: input.data.metadata,
      });
      const targetFieldNames = collectRecordFieldNames(transformedData.records);

      return Object.freeze({
        data: transformedData,
        metadata: Object.freeze({
          assetId: this.id,
          assetVersion: this.version,
          executedAt: new Date().toISOString(),
        }),
        mapping: Object.freeze({
          mappedAt: new Date().toISOString(),
          preserveUnmapped: config.preserveUnmapped,
          dropEmptyTargets: config.dropEmptyTargets,
          appliedMappings: Object.freeze(config.mappings.map((mapping) => Object.freeze({
            sourceField: mapping.sourceField,
            targetField: mapping.targetField,
          }))),
          sourceFieldNames,
          targetFieldNames,
          unmappedSourceFieldNames: Object.freeze(
            sourceFieldNames.filter((fieldName) => !config.mappings.some((mapping) => mapping.sourceField === fieldName)),
          ),
        }),
        sampleRows: collectSampleRows(transformedData, config.previewSampleSize),
      });
    }

    const sourceFieldNames = collectRowFieldNames(input.data.rows);
    const transformedRows = input.data.rows.map((row) => Object.freeze({
      ...row,
      cells: transformFieldRecord(row.cells, config),
    } satisfies CanonicalTableRow));
    const transformedData = createCanonicalTableShape({
      columns: buildMappedColumns(input.data.columns, input.data.rows, transformedRows, config),
      rows: Object.freeze(transformedRows),
      metadata: input.data.metadata,
    });
    const targetFieldNames = collectRowFieldNames(transformedData.rows);

    return Object.freeze({
      data: transformedData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt: new Date().toISOString(),
      }),
      mapping: Object.freeze({
        mappedAt: new Date().toISOString(),
        preserveUnmapped: config.preserveUnmapped,
        dropEmptyTargets: config.dropEmptyTargets,
        appliedMappings: Object.freeze(config.mappings.map((mapping) => Object.freeze({
          sourceField: mapping.sourceField,
          targetField: mapping.targetField,
        }))),
        sourceFieldNames,
        targetFieldNames,
        unmappedSourceFieldNames: Object.freeze(
          sourceFieldNames.filter((fieldName) => !config.mappings.some((mapping) => mapping.sourceField === fieldName)),
        ),
      }),
      sampleRows: collectSampleRows(transformedData, config.previewSampleSize),
    });
  }
}

