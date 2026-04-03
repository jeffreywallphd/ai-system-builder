import { z } from "zod";

const DatasetPipelineAssetDocumentVersion = "ai-loom.dataset-pipeline-draft.v1";

const OptionalStringSchema = z.string().trim().min(1).optional();
const JsonRecordSchema = z.record(z.unknown());

const DatasetPipelineSchemaReferenceSchema = z.object({
  assetId: OptionalStringSchema,
  versionId: OptionalStringSchema,
  inlineDefinition: JsonRecordSchema.optional(),
});

const DatasetPipelineSchemasSchema = z.object({
  input: DatasetPipelineSchemaReferenceSchema.optional(),
  output: DatasetPipelineSchemaReferenceSchema.optional(),
});

const DatasetPipelineSourceSchema = z.object({
  datasetRef: OptionalStringSchema,
  ingestionMode: OptionalStringSchema,
  description: OptionalStringSchema,
  schema: DatasetPipelineSchemaReferenceSchema.optional(),
});

const DatasetPipelineStepSchema = z.object({
  id: OptionalStringSchema,
  kind: OptionalStringSchema,
  mode: OptionalStringSchema,
  description: OptionalStringSchema,
  config: JsonRecordSchema.optional(),
});

const DatasetPipelineOutputSchema = z.object({
  datasetVersionTarget: OptionalStringSchema,
});

const DatasetPipelineSpecSchema = z.object({
  sources: z.array(DatasetPipelineSourceSchema).default([]),
  steps: z.array(DatasetPipelineStepSchema).default([]),
  outputs: DatasetPipelineOutputSchema.optional(),
  schemas: DatasetPipelineSchemasSchema.optional(),
  runtime: JsonRecordSchema.optional(),
});

const DatasetPipelineAssetDocumentSchema = z.object({
  schemaVersion: z.string().trim().min(1).default(DatasetPipelineAssetDocumentVersion),
  datasetPipelineSpec: DatasetPipelineSpecSchema.default({ sources: [], steps: [] }),
});

export type DatasetPipelineSchemaReference = z.infer<typeof DatasetPipelineSchemaReferenceSchema>;
export type DatasetPipelineAssetDocument = z.infer<typeof DatasetPipelineAssetDocumentSchema>;

export interface DatasetPipelineAssetDocumentParseResult {
  readonly document: DatasetPipelineAssetDocument;
  readonly issues: ReadonlyArray<string>;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function readString(record: Readonly<Record<string, unknown>> | undefined, key: string): string | undefined {
  if (!record) {
    return undefined;
  }
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function migrateLegacyDatasetPipelineSpec(raw: Readonly<Record<string, unknown>>): {
  readonly datasetPipelineSpec: Readonly<Record<string, unknown>>;
  readonly issues: ReadonlyArray<string>;
} {
  const issues: string[] = [];
  const providedSpec = asRecord(raw.datasetPipelineSpec);
  if (providedSpec) {
    const nextSpec: Record<string, unknown> = { ...providedSpec };
    if (!providedSpec.schemas && providedSpec.schema) {
      nextSpec.schemas = Object.freeze({
        input: Object.freeze({
          inlineDefinition: providedSpec.schema,
        }),
      });
      delete nextSpec.schema;
      issues.push("Converted a legacy pipeline schema definition into pipeline input schema linkage.");
    }
    return Object.freeze({
      datasetPipelineSpec: Object.freeze(nextSpec),
      issues: Object.freeze(issues),
    });
  }

  const datasetSpec = asRecord(raw.datasetSpec);
  if (!datasetSpec) {
    return Object.freeze({
      datasetPipelineSpec: Object.freeze({}),
      issues: Object.freeze([]),
    });
  }

  const source = readString(datasetSpec, "source");
  const format = readString(datasetSpec, "format");
  const schema = datasetSpec.schema;
  issues.push("Converted legacy dataset definition into the pipeline draft format used by Pipeline Studio.");

  const migrated = Object.freeze({
    sources: source
      ? Object.freeze([Object.freeze({
        datasetRef: source,
        ingestionMode: format ?? "batch",
      })])
      : Object.freeze([]),
    steps: Object.freeze([]),
    schemas: schema
      ? Object.freeze({
        input: Object.freeze({
          inlineDefinition: schema,
        }),
      })
      : undefined,
  });
  return Object.freeze({
    datasetPipelineSpec: migrated,
    issues: Object.freeze(issues),
  });
}

function normalizeSchemaReference(reference?: DatasetPipelineSchemaReference): DatasetPipelineSchemaReference | undefined {
  if (!reference) {
    return undefined;
  }
  const parsed = DatasetPipelineSchemaReferenceSchema.parse(reference);
  if (!parsed.assetId && !parsed.inlineDefinition) {
    return undefined;
  }
  return parsed;
}

export function createEmptyDatasetPipelineAssetDocument(): DatasetPipelineAssetDocument {
  return Object.freeze(
    DatasetPipelineAssetDocumentSchema.parse({
      schemaVersion: DatasetPipelineAssetDocumentVersion,
      datasetPipelineSpec: {
        sources: [],
        steps: [],
      },
    }),
  );
}

export function normalizeDatasetPipelineAssetDocument(input: DatasetPipelineAssetDocument): DatasetPipelineAssetDocument {
  const parsed = DatasetPipelineAssetDocumentSchema.parse(input);
  const schemas = parsed.datasetPipelineSpec.schemas;
  const normalized = {
    ...parsed,
    datasetPipelineSpec: {
      ...parsed.datasetPipelineSpec,
      schemas: schemas
        ? {
          input: normalizeSchemaReference(schemas.input),
          output: normalizeSchemaReference(schemas.output),
        }
        : undefined,
    },
  };

  return Object.freeze(DatasetPipelineAssetDocumentSchema.parse(normalized));
}

export function deserializeDatasetPipelineAssetDocumentForEditing(content: string): DatasetPipelineAssetDocumentParseResult {
  if (!content.trim()) {
    return Object.freeze({ document: createEmptyDatasetPipelineAssetDocument(), issues: Object.freeze([]) });
  }

  try {
    const raw = JSON.parse(content) as unknown;
    const rawRecord = asRecord(raw) ?? {};
    const migrated = migrateLegacyDatasetPipelineSpec(rawRecord);
    const document = normalizeDatasetPipelineAssetDocument(
      DatasetPipelineAssetDocumentSchema.parse({
        schemaVersion: typeof rawRecord.schemaVersion === "string"
          ? rawRecord.schemaVersion
          : DatasetPipelineAssetDocumentVersion,
        datasetPipelineSpec: migrated.datasetPipelineSpec,
      }),
    );
    return Object.freeze({ document, issues: migrated.issues });
  } catch {
    return Object.freeze({
      document: createEmptyDatasetPipelineAssetDocument(),
      issues: Object.freeze(["Some saved pipeline content was incomplete and has been reset to a safe default draft."]),
    });
  }
}

export function serializeDatasetPipelineAssetDocument(document: DatasetPipelineAssetDocument): string {
  return JSON.stringify(normalizeDatasetPipelineAssetDocument(document), null, 2);
}

export function updateDatasetPipelineSchemaReference(input: {
  readonly document: DatasetPipelineAssetDocument;
  readonly shape: "input" | "output";
  readonly reference?: DatasetPipelineSchemaReference;
}): DatasetPipelineAssetDocument {
  const normalized = normalizeDatasetPipelineAssetDocument(input.document);
  const currentSchemas = normalized.datasetPipelineSpec.schemas ?? {};
  const nextReference = normalizeSchemaReference(input.reference);
  const nextSchemas = {
    ...currentSchemas,
    [input.shape]: nextReference,
  } as const;

  const hasAnyReference = Boolean(nextSchemas.input || nextSchemas.output);
  return normalizeDatasetPipelineAssetDocument({
    ...normalized,
    datasetPipelineSpec: {
      ...normalized.datasetPipelineSpec,
      schemas: hasAnyReference ? nextSchemas : undefined,
    },
  });
}

export function updateDatasetPipelineSourceSchemaReference(input: {
  readonly document: DatasetPipelineAssetDocument;
  readonly sourceIndex: number;
  readonly reference?: DatasetPipelineSchemaReference;
}): DatasetPipelineAssetDocument {
  const normalized = normalizeDatasetPipelineAssetDocument(input.document);
  const source = normalized.datasetPipelineSpec.sources[input.sourceIndex];
  if (!source) {
    return normalized;
  }

  const nextSources = normalized.datasetPipelineSpec.sources.map((entry, index) => {
    if (index !== input.sourceIndex) {
      return entry;
    }
    const nextReference = normalizeSchemaReference(input.reference);
    if (!nextReference) {
      const { schema: _schema, ...rest } = entry;
      return rest;
    }
    return {
      ...entry,
      schema: nextReference,
    };
  });

  return normalizeDatasetPipelineAssetDocument({
    ...normalized,
    datasetPipelineSpec: {
      ...normalized.datasetPipelineSpec,
      sources: nextSources,
    },
  });
}

export function resolveDatasetPipelineSchemaReferenceStatus(input: {
  readonly reference?: DatasetPipelineSchemaReference;
  readonly availableSchemaAssetIds: ReadonlySet<string>;
}): "not-linked" | "inline" | "resolved" | "unresolved" {
  if (!input.reference) {
    return "not-linked";
  }
  if (input.reference.inlineDefinition && !input.reference.assetId) {
    return "inline";
  }
  if (!input.reference.assetId) {
    return "unresolved";
  }
  return input.availableSchemaAssetIds.has(input.reference.assetId) ? "resolved" : "unresolved";
}
