import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetConfigFieldKinds,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";

export const JsonIngestorErrorCodes = Object.freeze({
  invalidConfig: "json-ingestor-invalid-config",
  invalidJson: "json-ingestor-invalid-json",
  unsupportedShape: "json-ingestor-unsupported-shape",
} as const);

export type JsonIngestorErrorCode = typeof JsonIngestorErrorCodes[keyof typeof JsonIngestorErrorCodes];

export interface JsonIngestorDiagnostic {
  readonly code: JsonIngestorErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface JsonIngestorFieldSchema {
  readonly name: string;
  readonly valueType: "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown";
}

export const JsonIngestorConfigSchema = z.object({
  flatten: z.boolean().default(false),
  maxDepth: z.number().int().positive().optional(),
});

export type JsonIngestorConfig = z.output<typeof JsonIngestorConfigSchema>;

export interface JsonIngestorExecutionRequest {
  readonly payload:
    | string
    | Uint8Array
    | Readonly<Record<string, unknown>>
    | ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly config?: Partial<JsonIngestorConfig>;
}

export interface JsonIngestorExecutionSuccess {
  readonly ok: true;
  readonly config: JsonIngestorConfig;
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly diagnostics: ReadonlyArray<JsonIngestorDiagnostic>;
}

export interface JsonIngestorExecutionFailure {
  readonly ok: false;
  readonly diagnostics: ReadonlyArray<JsonIngestorDiagnostic>;
}

export type JsonIngestorExecutionResult = JsonIngestorExecutionSuccess | JsonIngestorExecutionFailure;

export interface JsonIngestorPreviewResult {
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly schema: ReadonlyArray<JsonIngestorFieldSchema>;
  readonly totalCount: number;
  readonly sampleCount: number;
}

function toPlainRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.freeze({ ...(value as Record<string, unknown>) });
}

function inferValueType(value: unknown): JsonIngestorFieldSchema["valueType"] {
  if (value === null) {
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

function inferSchema(records: ReadonlyArray<Readonly<Record<string, unknown>>>): ReadonlyArray<JsonIngestorFieldSchema> {
  const keys = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      keys.add(key);
    }
  }

  return Object.freeze([...keys].map((name) => {
    const firstValue = records.find((record) => name in record)?.[name];
    return Object.freeze({
      name,
      valueType: inferValueType(firstValue),
    } satisfies JsonIngestorFieldSchema);
  }));
}

function flattenRecord(
  value: Readonly<Record<string, unknown>>,
  maxDepth?: number,
): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = {};

  const visit = (node: unknown, prefix: string, depth: number): void => {
    if (node === null || typeof node !== "object" || Array.isArray(node)) {
      output[prefix] = node;
      return;
    }

    if (maxDepth !== undefined && depth >= maxDepth) {
      output[prefix] = node;
      return;
    }

    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length === 0) {
      output[prefix] = {};
      return;
    }

    for (const [key, child] of entries) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      visit(child, nextPrefix, depth + 1);
    }
  };

  for (const [key, child] of Object.entries(value)) {
    visit(child, key, 0);
  }

  return Object.freeze(output);
}

function normalizePayload(
  payload: JsonIngestorExecutionRequest["payload"],
): unknown {
  if (payload instanceof Uint8Array) {
    return JSON.parse(new TextDecoder("utf-8").decode(payload));
  }
  if (typeof payload === "string") {
    return JSON.parse(payload);
  }
  return payload;
}

export class JsonIngestorAsset {
  public static readonly assetId = "json-ingestor";
  public static readonly assetVersion = "1.0.0";

  public readonly inputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "JSON payload input for normalization into canonical records.",
  });

  public readonly outputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Canonical records output compatible with the data converter records boundary.",
  });

  public execute(request: JsonIngestorExecutionRequest): JsonIngestorExecutionResult {
    const parsedConfig = JsonIngestorConfigSchema.safeParse(request.config ?? {});
    if (!parsedConfig.success) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(parsedConfig.error.issues.map((issue) => Object.freeze({
          code: JsonIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path.join("."),
        } satisfies JsonIngestorDiagnostic))),
      });
    }

    let normalized: unknown;
    try {
      normalized = normalizePayload(request.payload);
    } catch (error) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: JsonIngestorErrorCodes.invalidJson,
          message: "JSON parsing failed.",
          details: Object.freeze({
            cause: error instanceof Error ? error.message : String(error),
          }),
        } satisfies JsonIngestorDiagnostic)]),
      });
    }

    let records: ReadonlyArray<Readonly<Record<string, unknown>>>;
    if (Array.isArray(normalized)) {
      const objectRecords = normalized.map((entry) => toPlainRecord(entry));
      if (objectRecords.some((entry) => !entry)) {
        return Object.freeze({
          ok: false,
          diagnostics: Object.freeze([Object.freeze({
            code: JsonIngestorErrorCodes.unsupportedShape,
            message: "JSON arrays must contain only object entries.",
          } satisfies JsonIngestorDiagnostic)]),
        });
      }
      records = Object.freeze(objectRecords as ReadonlyArray<Readonly<Record<string, unknown>>>);
    } else {
      const single = toPlainRecord(normalized);
      if (!single) {
        return Object.freeze({
          ok: false,
          diagnostics: Object.freeze([Object.freeze({
            code: JsonIngestorErrorCodes.unsupportedShape,
            message: "JSON payload must be an object or array of objects.",
          } satisfies JsonIngestorDiagnostic)]),
        });
      }
      records = Object.freeze([single]);
    }

    const config = parsedConfig.data;
    const normalizedRecords = config.flatten
      ? Object.freeze(records.map((record) => flattenRecord(record, config.maxDepth)))
      : records;

    return Object.freeze({
      ok: true,
      config,
      records: normalizedRecords,
      diagnostics: Object.freeze([]),
    });
  }

  public preview(request: JsonIngestorExecutionRequest, maxRows: number = 25): JsonIngestorPreviewResult | JsonIngestorExecutionFailure {
    const result = this.execute(request);
    if (!result.ok) {
      return result;
    }

    const boundedMaxRows = Math.min(Math.max(1, maxRows), 50);
    const sample = result.records.slice(0, boundedMaxRows);
    return Object.freeze({
      records: sample,
      schema: inferSchema(sample),
      totalCount: result.records.length,
      sampleCount: sample.length,
    });
  }
}

export function createJsonIngestorConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "flatten",
        label: "Flatten nested objects",
        kind: DataAssetConfigFieldKinds.boolean,
        defaultValue: false,
      },
      {
        key: "maxDepth",
        label: "Flatten max depth",
        kind: DataAssetConfigFieldKinds.number,
        min: 1,
      },
    ]),
  });
}

export function toJsonIngestorConfig(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): JsonIngestorConfig {
  return JsonIngestorConfigSchema.parse({
    flatten: typeof config.flatten === "boolean" ? config.flatten : false,
    maxDepth: typeof config.maxDepth === "number" ? config.maxDepth : undefined,
  });
}

export function createJsonIngestorDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: JsonIngestorAsset.assetId,
    name: "JSON Ingestor",
    version: JsonIngestorAsset.assetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://json-ingestor" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "json",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "JSON source input and normalization configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical records generated from JSON ingestion.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: JsonIngestorAsset.assetVersion,
    },
    semanticMetadata: {
      description: "First-class JSON ingestion asset producing canonical records.",
      tags: ["dataset", "ingestion", "json", "records"],
    },
  });
}
