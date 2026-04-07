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
import {
  countIssuesByField,
  summarizeValidationIssues,
  ValidationIssueSeverities,
  type ValidationIssue,
  type ValidationIssueSeverity,
} from "../ValidationIssueUtils";

export const DataValidationExpectedTypes = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
  array: "array",
  null: "null",
} as const);

export const DataValidationInvalidRowStrategies = Object.freeze({
  annotateAndKeep: "annotate-and-keep",
  dropInvalid: "drop-invalid",
  splitValidInvalid: "split-valid-invalid",
} as const);

const DataValidationFieldRuleSchema = z.object({
  fieldName: z.string().trim().min(1),
  required: z.boolean().default(false),
  expectedType: z.enum([
    DataValidationExpectedTypes.string,
    DataValidationExpectedTypes.number,
    DataValidationExpectedTypes.boolean,
    DataValidationExpectedTypes.object,
    DataValidationExpectedTypes.array,
    DataValidationExpectedTypes.null,
  ]).optional(),
  allowedValues: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  severity: z.enum([ValidationIssueSeverities.error, ValidationIssueSeverities.warning]).default(ValidationIssueSeverities.error),
}).superRefine((value, ctx) => {
  if (value.minLength !== undefined && value.maxLength !== undefined && value.minLength > value.maxLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minLength"],
      message: "minLength cannot be greater than maxLength.",
    });
  }
  if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["min"],
      message: "min cannot be greater than max.",
    });
  }
  if (value.pattern !== undefined) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(value.pattern);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pattern"],
        message: "pattern must be a valid regular expression.",
      });
    }
  }
});

export const DataValidationConfigSchema = z.object({
  fieldRules: z.array(DataValidationFieldRuleSchema).default([]),
  requiredFields: z.array(z.string().trim().min(1)).default([]),
  invalidRowStrategy: z.enum([
    DataValidationInvalidRowStrategies.annotateAndKeep,
    DataValidationInvalidRowStrategies.dropInvalid,
    DataValidationInvalidRowStrategies.splitValidInvalid,
  ]).default(DataValidationInvalidRowStrategies.annotateAndKeep),
  annotationFieldName: z.string().trim().min(1).default("_validation"),
  treatEmptyStringAsMissing: z.boolean().default(true),
  treatWhitespaceAsMissing: z.boolean().default(false),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const seenFields = new Set<string>();
  value.fieldRules.forEach((rule, index) => {
    if (seenFields.has(rule.fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldRules", index, "fieldName"],
        message: `Duplicate validation rule for '${rule.fieldName}' is not allowed.`,
      });
    }
    seenFields.add(rule.fieldName);
  });
  const seenRequired = new Set<string>();
  value.requiredFields.forEach((fieldName, index) => {
    if (seenRequired.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiredFields", index],
        message: `Duplicate required field '${fieldName}' is not allowed.`,
      });
    }
    seenRequired.add(fieldName);
  });
});

export type DataValidationConfig = z.output<typeof DataValidationConfigSchema>;

export interface DataValidationOutput extends ITransformationOutput {
  readonly validation: {
    readonly validatedAt: string;
    readonly invalidRowStrategy: string;
    readonly totalRows: number;
    readonly validRows: number;
    readonly invalidRows: number;
    readonly issueCount: number;
    readonly warningCount: number;
    readonly errorCount: number;
    readonly issuesByField: ReadonlyArray<Readonly<{
      fieldName: string;
      issueCount: number;
      warningCount: number;
      errorCount: number;
    }>>;
    readonly rowIssues: ReadonlyArray<ValidationIssue>;
    readonly invalidRowIds: ReadonlyArray<string>;
  };
  readonly splitResults?: {
    readonly validData: ITransformationInput["data"];
    readonly invalidData: ITransformationInput["data"];
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly rowDeltas: ReadonlyArray<TransformationPreviewRowDelta>;
    readonly issueSamples: ReadonlyArray<ValidationIssue>;
  };
}

const ValidationIssueSchema: z.ZodType<ValidationIssue> = z.object({
  rowId: z.string().min(1),
  fieldName: z.string().min(1),
  rule: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum([ValidationIssueSeverities.error, ValidationIssueSeverities.warning]),
});

const DataValidationOutputSchema: z.ZodType<DataValidationOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  validation: z.object({
    validatedAt: z.string().min(1),
    invalidRowStrategy: z.enum([
      DataValidationInvalidRowStrategies.annotateAndKeep,
      DataValidationInvalidRowStrategies.dropInvalid,
      DataValidationInvalidRowStrategies.splitValidInvalid,
    ]),
    totalRows: z.number().int().nonnegative(),
    validRows: z.number().int().nonnegative(),
    invalidRows: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    issuesByField: z.array(z.object({
      fieldName: z.string().min(1),
      issueCount: z.number().int().nonnegative(),
      warningCount: z.number().int().nonnegative(),
      errorCount: z.number().int().nonnegative(),
    })),
    rowIssues: z.array(ValidationIssueSchema),
    invalidRowIds: z.array(z.string().min(1)),
  }),
  splitResults: z.object({
    validData: TransformationInputSchema.shape.data,
    invalidData: TransformationInputSchema.shape.data,
  }).optional(),
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
    issueSamples: z.array(ValidationIssueSchema),
  }),
});

interface ValidationRow {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

function getValueType(value: CanonicalRecordValue | undefined): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function toRows(data: ITransformationInput["data"]): ReadonlyArray<ValidationRow> {
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

function validateRule(
  row: ValidationRow,
  rule: DataValidationConfig["fieldRules"][number],
  options: Readonly<{ treatEmptyStringAsMissing: boolean; treatWhitespaceAsMissing: boolean }>,
): ReadonlyArray<ValidationIssue> {
  const issues: ValidationIssue[] = [];
  const value = row.fields[rule.fieldName];
  const missing = isMissingValue(value, options);
  const severity: ValidationIssueSeverity = rule.severity;

  if (rule.required && missing) {
    issues.push(Object.freeze({
      rowId: row.rowId,
      fieldName: rule.fieldName,
      rule: "required",
      message: `Field '${rule.fieldName}' is required.`,
      severity,
    }));
    return Object.freeze(issues);
  }
  if (missing) {
    return Object.freeze(issues);
  }

  if (rule.expectedType && getValueType(value) !== rule.expectedType) {
    issues.push(Object.freeze({
      rowId: row.rowId,
      fieldName: rule.fieldName,
      rule: "type",
      message: `Field '${rule.fieldName}' must be of type '${rule.expectedType}'.`,
      severity,
    }));
  }

  if (rule.allowedValues.length > 0) {
    const allowed = new Set(rule.allowedValues.map((entry) => JSON.stringify(entry)));
    if (!allowed.has(JSON.stringify(value))) {
      issues.push(Object.freeze({
        rowId: row.rowId,
        fieldName: rule.fieldName,
        rule: "allowed-values",
        message: `Field '${rule.fieldName}' has a value outside of allowedValues.`,
        severity,
      }));
    }
  }

  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      issues.push(Object.freeze({
        rowId: row.rowId,
        fieldName: rule.fieldName,
        rule: "min-length",
        message: `Field '${rule.fieldName}' length is below ${rule.minLength}.`,
        severity,
      }));
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      issues.push(Object.freeze({
        rowId: row.rowId,
        fieldName: rule.fieldName,
        rule: "max-length",
        message: `Field '${rule.fieldName}' length exceeds ${rule.maxLength}.`,
        severity,
      }));
    }
    if (rule.pattern !== undefined) {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(value)) {
        issues.push(Object.freeze({
          rowId: row.rowId,
          fieldName: rule.fieldName,
          rule: "pattern",
          message: `Field '${rule.fieldName}' does not match required pattern.`,
          severity,
        }));
      }
    }
  }

  const numericValue = typeof value === "number" ? value : undefined;
  if (numericValue !== undefined) {
    if (rule.min !== undefined && numericValue < rule.min) {
      issues.push(Object.freeze({
        rowId: row.rowId,
        fieldName: rule.fieldName,
        rule: "min",
        message: `Field '${rule.fieldName}' is below minimum value ${rule.min}.`,
        severity,
      }));
    }
    if (rule.max !== undefined && numericValue > rule.max) {
      issues.push(Object.freeze({
        rowId: row.rowId,
        fieldName: rule.fieldName,
        rule: "max",
        message: `Field '${rule.fieldName}' exceeds maximum value ${rule.max}.`,
        severity,
      }));
    }
  }

  return Object.freeze(issues);
}

function buildEffectiveFieldRules(config: DataValidationConfig): ReadonlyArray<DataValidationConfig["fieldRules"][number]> {
  const rules = new Map<string, DataValidationConfig["fieldRules"][number]>();
  config.fieldRules.forEach((rule) => rules.set(rule.fieldName, rule));
  config.requiredFields.forEach((fieldName) => {
    const existing = rules.get(fieldName);
    if (existing) {
      rules.set(fieldName, Object.freeze({ ...existing, required: true }));
      return;
    }
    rules.set(fieldName, Object.freeze({
      fieldName,
      required: true,
      expectedType: undefined,
      allowedValues: Object.freeze([]),
      minLength: undefined,
      maxLength: undefined,
      min: undefined,
      max: undefined,
      pattern: undefined,
      severity: ValidationIssueSeverities.error,
    }));
  });

  return Object.freeze([...rules.values()].sort((left, right) => left.fieldName.localeCompare(right.fieldName)));
}

function buildAnnotatedFields(
  fields: Readonly<Record<string, CanonicalRecordValue>>,
  rowId: string,
  issuesByRow: ReadonlyMap<string, ReadonlyArray<ValidationIssue>>,
  annotationFieldName: string,
): Readonly<Record<string, CanonicalRecordValue>> {
  const rowIssues = issuesByRow.get(rowId) ?? [];
  return Object.freeze({
    ...fields,
    [annotationFieldName]: Object.freeze({
      valid: rowIssues.length === 0,
      issueCount: rowIssues.length,
      issues: Object.freeze(rowIssues.map((issue) => Object.freeze({
        fieldName: issue.fieldName,
        rule: issue.rule,
        severity: issue.severity,
      }))),
    }),
  });
}

export class DataValidationAsset extends BaseTransformationAsset<
  ITransformationInput,
  DataValidationOutput,
  DataValidationConfig
> {
  public static readonly assetId = "data-validation";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: DataValidationAsset.assetId,
      name: "Data Validation",
      description: "Validates canonical records/table rows against configurable rule-based constraints.",
      version: DataValidationAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: DataValidationOutputSchema,
      configSchema: DataValidationConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: DataValidationConfig): Promise<DataValidationOutput> {
    const rows = toRows(input.data);
    const effectiveRules = buildEffectiveFieldRules(config);
    const issues: ValidationIssue[] = [];
    for (const row of rows) {
      for (const rule of effectiveRules) {
        issues.push(...validateRule(row, rule, {
          treatEmptyStringAsMissing: config.treatEmptyStringAsMissing,
          treatWhitespaceAsMissing: config.treatWhitespaceAsMissing,
        }));
      }
    }

    const issuesByRow = new Map<string, ValidationIssue[]>();
    issues.forEach((issue) => {
      const collection = issuesByRow.get(issue.rowId);
      if (collection) {
        collection.push(issue);
        return;
      }
      issuesByRow.set(issue.rowId, [issue]);
    });
    const invalidRowIds = new Set(issues.map((issue) => issue.rowId));
    const summary = summarizeValidationIssues(rows.length, invalidRowIds, issues);
    const issuesByField = countIssuesByField(issues);
    const beforeRows = rows.map((row) => row.fields);
    const droppedRowIds = config.invalidRowStrategy === DataValidationInvalidRowStrategies.dropInvalid
      ? invalidRowIds
      : new Set<string>();
    const executedAt = new Date().toISOString();

    if (input.data.kind === TransformationInputDataKinds.records) {
      const transformedRecords: CanonicalRecordItem[] = input.data.records
        .filter((record) => config.invalidRowStrategy !== DataValidationInvalidRowStrategies.dropInvalid || !invalidRowIds.has(record.recordId))
        .map((record) => {
          if (config.invalidRowStrategy === DataValidationInvalidRowStrategies.annotateAndKeep) {
            return Object.freeze({
              ...record,
              fields: buildAnnotatedFields(record.fields, record.recordId, issuesByRow, config.annotationFieldName),
            } satisfies CanonicalRecordItem);
          }
          return Object.freeze({ ...record } satisfies CanonicalRecordItem);
        });

      const transformedData = createCanonicalRecordsShape({
        records: Object.freeze(transformedRecords),
        metadata: input.data.metadata,
      });
      const invalidData = createCanonicalRecordsShape({
        records: Object.freeze(input.data.records.filter((record) => invalidRowIds.has(record.recordId))),
        metadata: input.data.metadata,
      });
      const validData = createCanonicalRecordsShape({
        records: Object.freeze(input.data.records.filter((record) => !invalidRowIds.has(record.recordId))),
        metadata: input.data.metadata,
      });
      const afterRows = transformedData.records.map((record) => record.fields);

      return Object.freeze({
        data: config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid ? validData : transformedData,
        metadata: Object.freeze({
          assetId: this.id,
          assetVersion: this.version,
          executedAt,
        }),
        validation: Object.freeze({
          validatedAt: executedAt,
          invalidRowStrategy: config.invalidRowStrategy,
          ...summary,
          issuesByField,
          rowIssues: Object.freeze(issues),
          invalidRowIds: Object.freeze([...invalidRowIds].sort((left, right) => left.localeCompare(right))),
        }),
        splitResults: config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid
          ? Object.freeze({ validData, invalidData })
          : undefined,
        sampleRows: toSampleRows(
          config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid ? validData : transformedData,
          config.previewSampleSize,
        ),
        preview: Object.freeze({
          rowDeltas: buildPreviewRowDeltas({
            beforeRows,
            afterRows,
            rowIds: input.data.records.map((record) => record.recordId),
            afterRowIds: transformedData.records.map((record) => record.recordId),
            targetFields: Object.freeze([
              ...new Set(effectiveRules.map((rule) => rule.fieldName).concat(config.invalidRowStrategy === DataValidationInvalidRowStrategies.annotateAndKeep
                ? [config.annotationFieldName]
                : [])),
            ]),
            droppedRowIds,
            sampleSize: config.previewSampleSize,
          }),
          issueSamples: Object.freeze(issues.slice(0, config.previewSampleSize)),
        }),
      });
    }

    const transformedRows: CanonicalTableRow[] = input.data.rows
      .filter((row) => config.invalidRowStrategy !== DataValidationInvalidRowStrategies.dropInvalid || !invalidRowIds.has(row.rowId))
      .map((row) => {
        if (config.invalidRowStrategy === DataValidationInvalidRowStrategies.annotateAndKeep) {
          return Object.freeze({
            ...row,
            cells: buildAnnotatedFields(row.cells, row.rowId, issuesByRow, config.annotationFieldName),
          } satisfies CanonicalTableRow);
        }
        return Object.freeze({ ...row } satisfies CanonicalTableRow);
      });

    const transformedData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, transformedRows),
      rows: Object.freeze(transformedRows),
      metadata: input.data.metadata,
    });
    const invalidRows = input.data.rows.filter((row) => invalidRowIds.has(row.rowId));
    const validRows = input.data.rows.filter((row) => !invalidRowIds.has(row.rowId));
    const invalidData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, invalidRows),
      rows: Object.freeze(invalidRows),
      metadata: input.data.metadata,
    });
    const validData = createCanonicalTableShape({
      columns: rebuildTableColumnsFromRows(input.data.columns, validRows),
      rows: Object.freeze(validRows),
      metadata: input.data.metadata,
    });
    const afterRows = transformedData.rows.map((row) => row.cells);

    return Object.freeze({
      data: config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid ? validData : transformedData,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt,
      }),
      validation: Object.freeze({
        validatedAt: executedAt,
        invalidRowStrategy: config.invalidRowStrategy,
        ...summary,
        issuesByField,
        rowIssues: Object.freeze(issues),
        invalidRowIds: Object.freeze([...invalidRowIds].sort((left, right) => left.localeCompare(right))),
      }),
      splitResults: config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid
        ? Object.freeze({ validData, invalidData })
        : undefined,
      sampleRows: toSampleRows(
        config.invalidRowStrategy === DataValidationInvalidRowStrategies.splitValidInvalid ? validData : transformedData,
        config.previewSampleSize,
      ),
      preview: Object.freeze({
        rowDeltas: buildPreviewRowDeltas({
          beforeRows,
          afterRows,
          rowIds: input.data.rows.map((row) => row.rowId),
          afterRowIds: transformedData.rows.map((row) => row.rowId),
          targetFields: Object.freeze([
            ...new Set(effectiveRules.map((rule) => rule.fieldName).concat(config.invalidRowStrategy === DataValidationInvalidRowStrategies.annotateAndKeep
              ? [config.annotationFieldName]
              : [])),
          ]),
          droppedRowIds,
          sampleSize: config.previewSampleSize,
        }),
        issueSamples: Object.freeze(issues.slice(0, config.previewSampleSize)),
      }),
    });
  }
}
