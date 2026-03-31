import { parse } from "csv-parse/sync";
import { z } from "zod";
import { AssetContractShapeKinds } from "../../domain/contracts/AssetContract";
import { CanonicalDataAsset } from "../../domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetConfigFieldKinds,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";

export const CsvIngestorErrorCodes = Object.freeze({
  invalidConfig: "csv-ingestor-invalid-config",
  invalidCsv: "csv-ingestor-invalid-csv",
  invalidEncoding: "csv-ingestor-invalid-encoding",
  missingHeaders: "csv-ingestor-missing-headers",
} as const);

export type CsvIngestorErrorCode = typeof CsvIngestorErrorCodes[keyof typeof CsvIngestorErrorCodes];

export interface CsvIngestorDiagnostic {
  readonly code: CsvIngestorErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CsvIngestorFieldSchema {
  readonly name: string;
  readonly valueType: "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown";
}

export const CsvIngestorConfigSchema = z.object({
  delimiter: z.string().min(1).max(4).default(","),
  header: z.union([z.boolean(), z.literal("auto")]).default("auto"),
  encoding: z.string().min(1).default("utf-8"),
  skipEmptyLines: z.boolean().default(true),
  normalizeHeadersToLowercase: z.boolean().default(false),
});

export type CsvIngestorConfig = z.output<typeof CsvIngestorConfigSchema>;

export interface CsvIngestorExecutionRequest {
  readonly payload: string | Uint8Array;
  readonly config?: Partial<CsvIngestorConfig>;
  readonly fileName?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface CsvIngestorExecutionSuccess {
  readonly ok: true;
  readonly config: CsvIngestorConfig;
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly diagnostics: ReadonlyArray<CsvIngestorDiagnostic>;
}

export interface CsvIngestorExecutionFailure {
  readonly ok: false;
  readonly diagnostics: ReadonlyArray<CsvIngestorDiagnostic>;
}

export type CsvIngestorExecutionResult = CsvIngestorExecutionSuccess | CsvIngestorExecutionFailure;

export interface CsvIngestorPreviewResult {
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly schema: ReadonlyArray<CsvIngestorFieldSchema>;
  readonly totalCount: number;
  readonly sampleCount: number;
}

function decodePayload(payload: string | Uint8Array, encoding: string): string {
  if (typeof payload === "string") {
    return payload.replace(/\r\n/g, "\n");
  }
  return new TextDecoder(encoding).decode(payload).replace(/\r\n/g, "\n");
}

function normalizeHeader(
  value: string,
  index: number,
  config: CsvIngestorConfig,
): string {
  const trimmed = value.trim();
  const normalized = config.normalizeHeadersToLowercase ? trimmed.toLowerCase() : trimmed;
  return normalized || `column_${index + 1}`;
}

function inferHeaderMode(content: string, delimiter: string): boolean {
  const firstLine = content.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
  if (!firstLine) {
    return true;
  }

  const cells = firstLine.split(delimiter).map((cell) => cell.trim());
  if (cells.length === 0) {
    return true;
  }
  const uniqueCount = new Set(cells).size;
  const mostlyText = cells.filter((cell) => cell.length > 0 && Number.isNaN(Number(cell))).length >= Math.ceil(cells.length * 0.7);
  return uniqueCount === cells.length && mostlyText;
}

function inferValueType(value: unknown): CsvIngestorFieldSchema["valueType"] {
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

function inferSchema(records: ReadonlyArray<Readonly<Record<string, unknown>>>): ReadonlyArray<CsvIngestorFieldSchema> {
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
    } satisfies CsvIngestorFieldSchema);
  }));
}

export class CsvIngestorAsset {
  public static readonly assetId = "csv-ingestor";
  public static readonly assetVersion = "1.0.0";

  public readonly inputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Delimited file payload with CSV parsing configuration.",
  });

  public readonly outputContract = Object.freeze({
    kind: AssetContractShapeKinds.jsonSchema,
    description: "Canonical records output compatible with the data converter records boundary.",
  });

  public execute(request: CsvIngestorExecutionRequest): CsvIngestorExecutionResult {
    const parsedConfig = CsvIngestorConfigSchema.safeParse(request.config ?? {});
    if (!parsedConfig.success) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(parsedConfig.error.issues.map((issue) => Object.freeze({
          code: CsvIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path.join("."),
        } satisfies CsvIngestorDiagnostic))),
      });
    }

    const config = parsedConfig.data;
    let normalizedContent: string;
    try {
      normalizedContent = decodePayload(request.payload, config.encoding);
    } catch (error) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: CsvIngestorErrorCodes.invalidEncoding,
          message: "CSV payload could not be decoded with the configured encoding.",
          details: Object.freeze({
            encoding: config.encoding,
            cause: error instanceof Error ? error.message : String(error),
          }),
        } satisfies CsvIngestorDiagnostic)]),
      });
    }

    const trimmed = normalizedContent.trim();
    if (!trimmed) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: CsvIngestorErrorCodes.invalidCsv,
          message: "CSV content is empty.",
        } satisfies CsvIngestorDiagnostic)]),
      });
    }

    const headerMode = config.header === "auto" ? inferHeaderMode(trimmed, config.delimiter) : config.header;

    try {
      if (headerMode) {
        const records = parse(trimmed, {
          delimiter: config.delimiter,
          bom: true,
          trim: true,
          skip_empty_lines: config.skipEmptyLines,
          relax_column_count: true,
          columns: (header: string[]) => {
            const normalized = header.map((entry, index) => normalizeHeader(entry, index, config));
            const missingCount = header.filter((entry) => entry.trim().length === 0).length;
            if (missingCount > 0 && config.header === true) {
              throw new Error("CSV header row includes one or more empty column names.");
            }
            return normalized;
          },
        }) as Array<Record<string, string>>;

        return Object.freeze({
          ok: true,
          config,
          records: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
          diagnostics: Object.freeze([]),
        });
      }

      const rows = parse(trimmed, {
        delimiter: config.delimiter,
        bom: true,
        trim: true,
        skip_empty_lines: config.skipEmptyLines,
        relax_column_count: true,
        columns: false,
      }) as Array<Array<string>>;

      const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
      const records = rows.map((row) => {
        const record: Record<string, string> = {};
        for (let index = 0; index < maxColumns; index += 1) {
          record[`column_${index + 1}`] = row[index] ?? "";
        }
        return Object.freeze(record);
      });

      return Object.freeze({
        ok: true,
        config,
        records: Object.freeze(records),
        diagnostics: Object.freeze([]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.includes("header")
        ? CsvIngestorErrorCodes.missingHeaders
        : CsvIngestorErrorCodes.invalidCsv;
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code,
          message,
        } satisfies CsvIngestorDiagnostic)]),
      });
    }
  }

  public preview(request: CsvIngestorExecutionRequest, maxRows: number = 25): CsvIngestorPreviewResult | CsvIngestorExecutionFailure {
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

export function createCsvIngestorConfigSchema(assetId: string): DataAssetConfigSchema {
  return createDataAssetConfigSchema({
    schemaId: `data-asset.${assetId}.config`,
    version: "1.0.0",
    fields: Object.freeze([
      {
        key: "delimiter",
        label: "Delimiter",
        kind: DataAssetConfigFieldKinds.select,
        required: true,
        defaultValue: ",",
        options: Object.freeze([
          { value: ",", label: "Comma" },
          { value: "\t", label: "Tab" },
          { value: ";", label: "Semicolon" },
          { value: "|", label: "Pipe" },
        ]),
      },
      {
        key: "header",
        label: "Header mode",
        kind: DataAssetConfigFieldKinds.select,
        required: true,
        defaultValue: "auto",
        options: Object.freeze([
          { value: "auto", label: "Auto detect" },
          { value: "true", label: "Header row required" },
          { value: "false", label: "No header row" },
        ]),
      },
      {
        key: "encoding",
        label: "Encoding",
        kind: DataAssetConfigFieldKinds.string,
        required: true,
        defaultValue: "utf-8",
      },
      {
        key: "skipEmptyLines",
        label: "Skip empty lines",
        kind: DataAssetConfigFieldKinds.boolean,
        defaultValue: true,
      },
      {
        key: "normalizeHeadersToLowercase",
        label: "Lowercase headers",
        kind: DataAssetConfigFieldKinds.boolean,
        defaultValue: false,
      },
    ]),
  });
}

function toHeaderConfig(value: CanonicalRecordValue | undefined): CsvIngestorConfig["header"] {
  if (value === "true" || value === true) {
    return true;
  }
  if (value === "false" || value === false) {
    return false;
  }
  return "auto";
}

export function toCsvIngestorConfig(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CsvIngestorConfig {
  return CsvIngestorConfigSchema.parse({
    delimiter: typeof config.delimiter === "string" ? config.delimiter : ",",
    header: toHeaderConfig(config.header),
    encoding: typeof config.encoding === "string" ? config.encoding : "utf-8",
    skipEmptyLines: typeof config.skipEmptyLines === "boolean" ? config.skipEmptyLines : true,
    normalizeHeadersToLowercase: typeof config.normalizeHeadersToLowercase === "boolean"
      ? config.normalizeHeadersToLowercase
      : false,
  });
}

export function createCsvIngestorDataAsset(
  config: Readonly<Record<string, CanonicalRecordValue>>,
): CanonicalDataAsset {
  return new CanonicalDataAsset({
    id: CsvIngestorAsset.assetId,
    name: "CSV Ingestor",
    version: CsvIngestorAsset.assetVersion,
    source: { type: "generated", workflowId: "dataset-studio-ingestors" },
    location: { accessMethod: "virtual", location: "dataset://csv-ingestor" },
    outputShape: createCanonicalRecordsShape({
      records: Object.freeze([]),
      metadata: {
        schemaVersion: "1.0.0",
        source: {
          format: "csv",
        },
      },
    }),
    contracts: {
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Delimited source input and CSV configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Canonical records generated from CSV parsing.",
      },
    },
    config,
    versionMetadata: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
      publishedVersionId: CsvIngestorAsset.assetVersion,
    },
    semanticMetadata: {
      description: "First-class CSV ingestion asset producing canonical records.",
      tags: ["dataset", "ingestion", "csv", "records"],
    },
  });
}
