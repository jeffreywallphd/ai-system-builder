import { z } from "zod";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import { BaseTransformationAsset } from "../BaseTransformationAsset";
import {
  classifyFieldByHeuristics,
  ClassificationPiiLikelihoods,
  ClassificationSemanticTypeGuesses,
  ClassificationSensitivityTags,
  type ClassificationHeuristicFieldResult,
} from "../ClassificationHeuristics";
import {
  TransformationInputDataKinds,
  TransformationInputSchema,
  type ITransformationInput,
  type ITransformationOutput,
} from "../TransformationContracts";
import { sampleTransformationInputData } from "../TransformationSampling";

export const DataClassificationClassifierKinds = Object.freeze({
  semantic: "semantic",
  pii: "pii",
  sensitivity: "sensitivity",
  content: "content",
} as const);

const DataClassificationEnabledClassifierSchema = z.enum([
  DataClassificationClassifierKinds.semantic,
  DataClassificationClassifierKinds.pii,
  DataClassificationClassifierKinds.sensitivity,
  DataClassificationClassifierKinds.content,
]);

export const DataClassificationConfigSchema = z.object({
  sampleSize: z.number().int().min(1).max(10000).default(500),
  enabledClassifiers: z.array(DataClassificationEnabledClassifierSchema).default([
    DataClassificationClassifierKinds.semantic,
    DataClassificationClassifierKinds.pii,
    DataClassificationClassifierKinds.sensitivity,
    DataClassificationClassifierKinds.content,
  ]),
  includeFields: z.array(z.string().trim().min(1)).default([]),
  excludeFields: z.array(z.string().trim().min(1)).default([]),
  confidenceThreshold: z.number().min(0).max(1).default(0),
  emitFieldLevelTags: z.boolean().default(true),
  emitRecordLevelTags: z.boolean().default(false),
  useFieldNames: z.boolean().default(true),
  inferredFieldTypes: z.record(z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "object",
    "array",
    "null",
    "unknown",
  ])).default({}),
  maxSampleValuesPerField: z.number().int().min(1).max(10).default(3),
  previewSampleSize: z.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  const includeSeen = new Set<string>();
  value.includeFields.forEach((fieldName, index) => {
    if (includeSeen.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["includeFields", index],
        message: `Duplicate include field '${fieldName}' is not allowed.`,
      });
      return;
    }
    includeSeen.add(fieldName);
  });

  const excludeSeen = new Set<string>();
  value.excludeFields.forEach((fieldName, index) => {
    if (excludeSeen.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludeFields", index],
        message: `Duplicate exclude field '${fieldName}' is not allowed.`,
      });
      return;
    }
    excludeSeen.add(fieldName);
  });

  const classifierSeen = new Set<string>();
  value.enabledClassifiers.forEach((entry, index) => {
    if (classifierSeen.has(entry)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabledClassifiers", index],
        message: `Duplicate classifier '${entry}' is not allowed.`,
      });
      return;
    }
    classifierSeen.add(entry);
  });
});

export type DataClassificationConfig = z.output<typeof DataClassificationConfigSchema>;

export interface DataClassificationFieldResult {
  readonly fieldName: string;
  readonly semanticTypeGuess: string;
  readonly piiLikelihood: string;
  readonly sensitivity: string;
  readonly confidence: number;
  readonly tags: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<string>;
  readonly metrics: Readonly<{
    nonNullCount: number;
    distinctCount: number;
    distinctRatio: number;
    averageStringLength?: number;
    emailMatchRatio: number;
    phoneMatchRatio: number;
    dateLikeRatio: number;
    numericLikeRatio: number;
  }>;
  readonly sampleValues: ReadonlyArray<CanonicalRecordValue>;
}

export interface DataClassificationRecordFlag {
  readonly rowId: string;
  readonly tags: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<string>;
}

export interface DataClassificationOutput extends ITransformationOutput {
  readonly classification: {
    readonly classifiedAt: string;
    readonly classifiers: ReadonlyArray<string>;
    readonly totalRows: number;
    readonly classifiedRowCount: number;
    readonly fieldCount: number;
    readonly fields: ReadonlyArray<DataClassificationFieldResult>;
    readonly summary: {
      readonly piiFieldCount: number;
      readonly highSensitivityFieldCount: number;
      readonly semanticTypeCounts: Readonly<Record<string, number>>;
    };
  };
  readonly recordFlags?: {
    readonly flaggedRows: number;
    readonly rows: ReadonlyArray<DataClassificationRecordFlag>;
  };
  readonly sampleRows: ReadonlyArray<Readonly<Record<string, CanonicalRecordValue>>>;
  readonly preview: {
    readonly fieldSummaries: ReadonlyArray<Readonly<{
      fieldName: string;
      tags: ReadonlyArray<string>;
      reasons: ReadonlyArray<string>;
      sampleValues: ReadonlyArray<CanonicalRecordValue>;
    }>>;
    readonly recordSamples: ReadonlyArray<DataClassificationRecordFlag>;
  };
}

const DataClassificationFieldResultSchema: z.ZodType<DataClassificationFieldResult> = z.object({
  fieldName: z.string().min(1),
  semanticTypeGuess: z.enum([
    ClassificationSemanticTypeGuesses.email,
    ClassificationSemanticTypeGuesses.phone,
    ClassificationSemanticTypeGuesses.nameLike,
    ClassificationSemanticTypeGuesses.addressLike,
    ClassificationSemanticTypeGuesses.dateLike,
    ClassificationSemanticTypeGuesses.identifierLike,
    ClassificationSemanticTypeGuesses.numericMeasure,
    ClassificationSemanticTypeGuesses.category,
    ClassificationSemanticTypeGuesses.freeText,
    ClassificationSemanticTypeGuesses.unknown,
  ]),
  piiLikelihood: z.enum([
    ClassificationPiiLikelihoods.none,
    ClassificationPiiLikelihoods.low,
    ClassificationPiiLikelihoods.medium,
    ClassificationPiiLikelihoods.high,
  ]),
  sensitivity: z.enum([
    ClassificationSensitivityTags.low,
    ClassificationSensitivityTags.medium,
    ClassificationSensitivityTags.high,
  ]),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)),
  metrics: z.object({
    nonNullCount: z.number().int().nonnegative(),
    distinctCount: z.number().int().nonnegative(),
    distinctRatio: z.number().min(0).max(1),
    averageStringLength: z.number().nonnegative().optional(),
    emailMatchRatio: z.number().min(0).max(1),
    phoneMatchRatio: z.number().min(0).max(1),
    dateLikeRatio: z.number().min(0).max(1),
    numericLikeRatio: z.number().min(0).max(1),
  }),
  sampleValues: z.array(z.unknown()),
});

const DataClassificationRecordFlagSchema: z.ZodType<DataClassificationRecordFlag> = z.object({
  rowId: z.string().min(1),
  tags: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1)),
});

const DataClassificationOutputSchema: z.ZodType<DataClassificationOutput> = z.object({
  data: TransformationInputSchema.shape.data,
  metadata: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
    executedAt: z.string().min(1),
  }),
  classification: z.object({
    classifiedAt: z.string().min(1),
    classifiers: z.array(DataClassificationEnabledClassifierSchema),
    totalRows: z.number().int().nonnegative(),
    classifiedRowCount: z.number().int().nonnegative(),
    fieldCount: z.number().int().nonnegative(),
    fields: z.array(DataClassificationFieldResultSchema),
    summary: z.object({
      piiFieldCount: z.number().int().nonnegative(),
      highSensitivityFieldCount: z.number().int().nonnegative(),
      semanticTypeCounts: z.record(z.number().int().nonnegative()),
    }),
  }),
  recordFlags: z.object({
    flaggedRows: z.number().int().nonnegative(),
    rows: z.array(DataClassificationRecordFlagSchema),
  }).optional(),
  sampleRows: z.array(z.record(z.unknown())),
  preview: z.object({
    fieldSummaries: z.array(z.object({
      fieldName: z.string().min(1),
      tags: z.array(z.string().min(1)),
      reasons: z.array(z.string().min(1)),
      sampleValues: z.array(z.unknown()),
    })),
    recordSamples: z.array(DataClassificationRecordFlagSchema),
  }),
});

interface ClassificationRow {
  readonly rowId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
}

function toRows(data: ITransformationInput["data"]): ReadonlyArray<ClassificationRow> {
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

function collectFieldNames(rows: ReadonlyArray<ClassificationRow>): ReadonlyArray<string> {
  const names = new Set<string>();
  for (const row of rows) {
    Object.keys(row.fields).forEach((fieldName) => names.add(fieldName));
  }
  return Object.freeze([...names].sort((left, right) => left.localeCompare(right)));
}

function isPresentValue(value: CanonicalRecordValue | undefined): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function selectFieldNames(
  fieldNames: ReadonlyArray<string>,
  config: DataClassificationConfig,
): ReadonlyArray<string> {
  const include = new Set(config.includeFields);
  const exclude = new Set(config.excludeFields);
  return Object.freeze(fieldNames.filter((fieldName) => {
    if (exclude.has(fieldName)) {
      return false;
    }
    if (include.size > 0 && !include.has(fieldName)) {
      return false;
    }
    return true;
  }));
}

function applyClassifierFilter(
  result: ClassificationHeuristicFieldResult,
  enabledClassifiers: ReadonlyArray<string>,
): DataClassificationFieldResult {
  const allowSemantic = enabledClassifiers.includes(DataClassificationClassifierKinds.semantic);
  const allowPii = enabledClassifiers.includes(DataClassificationClassifierKinds.pii);
  const allowSensitivity = enabledClassifiers.includes(DataClassificationClassifierKinds.sensitivity);
  const allowContent = enabledClassifiers.includes(DataClassificationClassifierKinds.content);

  const tags = result.tags.filter((tag) => {
    if (tag.startsWith("semantic.")) {
      return allowSemantic;
    }
    if (tag.startsWith("pii.")) {
      return allowPii;
    }
    if (tag.startsWith("sensitivity.")) {
      return allowSensitivity;
    }
    if (tag.startsWith("content.")) {
      return allowContent;
    }
    return true;
  });

  return Object.freeze({
    fieldName: result.fieldName,
    semanticTypeGuess: allowSemantic ? result.semanticTypeGuess : ClassificationSemanticTypeGuesses.unknown,
    piiLikelihood: allowPii ? result.piiLikelihood : ClassificationPiiLikelihoods.none,
    sensitivity: allowSensitivity ? result.sensitivity : ClassificationSensitivityTags.low,
    confidence: result.confidence,
    tags: Object.freeze(tags),
    reasons: result.reasons,
    metrics: result.metrics,
    sampleValues: result.sampleValues,
  });
}

function buildRecordFlags(
  rows: ReadonlyArray<ClassificationRow>,
  fieldResults: ReadonlyArray<DataClassificationFieldResult>,
  maxRows: number,
): ReadonlyArray<DataClassificationRecordFlag> {
  const flags: DataClassificationRecordFlag[] = [];
  for (const row of rows) {
    const tags = new Set<string>();
    const reasons: string[] = [];
    for (const fieldResult of fieldResults) {
      if (!isPresentValue(row.fields[fieldResult.fieldName])) {
        continue;
      }
      fieldResult.tags
        .filter((tag) => tag.startsWith("pii.") || tag.startsWith("sensitivity."))
        .forEach((tag) => tags.add(tag));
      if (fieldResult.tags.some((tag) => tag.startsWith("pii."))) {
        reasons.push(`field:${fieldResult.fieldName}`);
      }
    }
    if (tags.size === 0) {
      continue;
    }
    flags.push(Object.freeze({
      rowId: row.rowId,
      tags: Object.freeze([...tags].sort((left, right) => left.localeCompare(right))),
      reasons: Object.freeze(reasons.slice(0, 5)),
    }));
    if (flags.length >= maxRows) {
      break;
    }
  }
  return Object.freeze(flags);
}

export class DataClassificationAsset extends BaseTransformationAsset<
  ITransformationInput,
  DataClassificationOutput,
  DataClassificationConfig
> {
  public static readonly assetId = "data-classification";
  public static readonly assetVersion = "1.0.0";

  constructor() {
    super({
      id: DataClassificationAsset.assetId,
      name: "Data Classification",
      description: "Classifies fields and rows with rule-based semantic, PII, and sensitivity tags for governance-aware pipelines.",
      version: DataClassificationAsset.assetVersion,
      inputSchema: TransformationInputSchema,
      outputSchema: DataClassificationOutputSchema,
      configSchema: DataClassificationConfigSchema,
    });
  }

  protected override async run(input: ITransformationInput, config: DataClassificationConfig): Promise<DataClassificationOutput> {
    const sampledData = sampleTransformationInputData(input.data, config.sampleSize);
    const sampledRows = toRows(sampledData);
    const allRows = toRows(input.data);
    const targetFieldNames = selectFieldNames(collectFieldNames(sampledRows), config);
    const rawFieldResults = targetFieldNames
      .map((fieldName) => classifyFieldByHeuristics({
        fieldName,
        values: sampledRows.map((row) => row.fields[fieldName]),
        useFieldNames: config.useFieldNames,
        inferredFieldType: config.inferredFieldTypes[fieldName],
        maxSampleValuesPerField: config.maxSampleValuesPerField,
      }))
      .filter((result) => result.confidence >= config.confidenceThreshold);
    const filteredFieldResults = rawFieldResults.map((result) => applyClassifierFilter(result, config.enabledClassifiers));
    const fieldResults = config.emitFieldLevelTags ? filteredFieldResults : [];
    const semanticTypeCounts = fieldResults.reduce<Record<string, number>>((accumulator, field) => {
      accumulator[field.semanticTypeGuess] = (accumulator[field.semanticTypeGuess] ?? 0) + 1;
      return accumulator;
    }, {});
    const piiFieldCount = fieldResults.filter((field) => field.tags.some((tag) => tag.startsWith("pii."))).length;
    const highSensitivityFieldCount = fieldResults.filter((field) => field.sensitivity === ClassificationSensitivityTags.high).length;
    const recordFlags = config.emitRecordLevelTags
      ? buildRecordFlags(allRows, filteredFieldResults, Math.max(config.previewSampleSize * 5, 100))
      : Object.freeze([]);
    const executedAt = new Date().toISOString();

    return Object.freeze({
      data: input.data,
      metadata: Object.freeze({
        assetId: this.id,
        assetVersion: this.version,
        executedAt,
      }),
      classification: Object.freeze({
        classifiedAt: executedAt,
        classifiers: Object.freeze([...config.enabledClassifiers]),
        totalRows: allRows.length,
        classifiedRowCount: sampledRows.length,
        fieldCount: fieldResults.length,
        fields: Object.freeze(fieldResults),
        summary: Object.freeze({
          piiFieldCount,
          highSensitivityFieldCount,
          semanticTypeCounts: Object.freeze(semanticTypeCounts),
        }),
      }),
      recordFlags: config.emitRecordLevelTags
        ? Object.freeze({
          flaggedRows: recordFlags.length,
          rows: recordFlags,
        })
        : undefined,
      sampleRows: Object.freeze(sampledRows.slice(0, config.previewSampleSize).map((row) => row.fields)),
      preview: Object.freeze({
        fieldSummaries: Object.freeze(fieldResults.slice(0, config.previewSampleSize).map((field) => Object.freeze({
          fieldName: field.fieldName,
          tags: field.tags,
          reasons: field.reasons,
          sampleValues: field.sampleValues,
        }))),
        recordSamples: Object.freeze(recordFlags.slice(0, config.previewSampleSize)),
      }),
    });
  }
}

