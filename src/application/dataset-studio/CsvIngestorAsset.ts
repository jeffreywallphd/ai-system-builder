import { parse } from "csv-parse/sync";
import { z } from "zod";
import { AssetContractShapeKinds } from "@domain/contracts/AssetContract";
import { CanonicalDataAsset } from "@domain/dataset-studio/CanonicalDataAsset";
import { createCanonicalRecordsShape, type CanonicalRecordValue, type CanonicalRecordsShape } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  DataAssetConfigFieldKinds,
  DataAssetConfigFieldVisibilities,
  createDataAssetConfigSchema,
  type DataAssetConfigSchema,
} from "./DataAssetConfiguration";
import {
  IngestionIssueCategories,
  IngestionIssueRecoverabilities,
  IngestionExecutionContextSchema,
  Uint8ArraySchema,
  contextToIssueSource,
  createIngestionIssue,
  toIngestionIssueFromError,
  toIngestionIssuesFromZodError,
  type IngestionExecutionContext,
} from "./IngestionContracts";
import {
  buildIngestionFailureEnvelope,
  buildIngestionPreviewEnvelope,
  buildIngestionSuccessEnvelope,
  normalizeRecordsOutput,
  type IngestionFailureEnvelope,
  type IngestionPreviewEnvelope,
  type IngestionSuccessEnvelope,
} from "./IngestionCanonicalNormalization";

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
  readonly contentType?: string;
  readonly sourceReference?: string;
  readonly sourceId?: string;
  readonly batchId?: string;
  readonly batchItemId?: string;
  readonly groupId?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly context?: Partial<IngestionExecutionContext>;
}

export interface CsvIngestorExecutionSuccess {
  readonly ok: true;
  readonly config: CsvIngestorConfig;
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly output: CanonicalRecordsShape;
  readonly normalized: IngestionSuccessEnvelope<CanonicalRecordsShape>;
  readonly diagnostics: ReadonlyArray<CsvIngestorDiagnostic>;
}

export interface CsvIngestorExecutionFailure {
  readonly ok: false;
  readonly normalized: IngestionFailureEnvelope;
  readonly diagnostics: ReadonlyArray<CsvIngestorDiagnostic>;
}

export type CsvIngestorExecutionResult = CsvIngestorExecutionSuccess | CsvIngestorExecutionFailure;

export interface CsvIngestorPreviewResult {
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly schema: ReadonlyArray<CsvIngestorFieldSchema>;
  readonly totalCount: number;
  readonly sampleCount: number;
  readonly normalized: IngestionPreviewEnvelope;
}

const CsvIngestorExecutionRequestSchema = z.object({
  payload: z.union([z.string(), Uint8ArraySchema]),
  config: CsvIngestorConfigSchema.partial().optional(),
  fileName: z.string().trim().min(1).optional(),
  contentType: z.string().trim().min(1).optional(),
  sourceReference: z.string().trim().min(1).optional(),
  sourceId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  batchItemId: z.string().trim().min(1).optional(),
  groupId: z.string().trim().min(1).optional(),
  sourceAssetId: z.string().trim().min(1).optional(),
  sourceVersionId: z.string().trim().min(1).optional(),
  context: IngestionExecutionContextSchema.partial().optional(),
});

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
    const assetIdentity = Object.freeze({
      assetId: CsvIngestorAsset.assetId,
      assetVersion: CsvIngestorAsset.assetVersion,
    });
    const parsedRequest = CsvIngestorExecutionRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      const parsedContext = IngestionExecutionContextSchema.safeParse(request.context ?? {});
      const issueSource = contextToIssueSource(parsedContext.success ? parsedContext.data : request.context);
      const issues = toIngestionIssuesFromZodError(parsedRequest.error, CsvIngestorErrorCodes.invalidConfig, {
        category: IngestionIssueCategories.invalidConfiguration,
        source: issueSource,
      });
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(issues.map((issue) => Object.freeze({
          code: CsvIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path,
        } satisfies CsvIngestorDiagnostic))),
        normalized: buildIngestionFailureEnvelope({
          context: parsedContext.success ? parsedContext.data : IngestionExecutionContextSchema.parse({}),
          issues,
          asset: assetIdentity,
          configSummary: request.config,
        }),
      });
    }

    const normalizedRequest = parsedRequest.data;
    const ingestionContext = IngestionExecutionContextSchema.parse({
      ...normalizedRequest.context,
      sourceId: normalizedRequest.sourceId ?? normalizedRequest.context?.sourceId,
      sourceReference: normalizedRequest.sourceReference ?? normalizedRequest.context?.sourceReference,
      sourceAssetId: normalizedRequest.sourceAssetId ?? normalizedRequest.context?.sourceAssetId,
      sourceVersionId: normalizedRequest.sourceVersionId ?? normalizedRequest.context?.sourceVersionId,
      fileName: normalizedRequest.fileName ?? normalizedRequest.context?.fileName,
      contentType: normalizedRequest.contentType ?? normalizedRequest.context?.contentType,
      batchId: normalizedRequest.batchId ?? normalizedRequest.context?.batchId,
      batchItemId: normalizedRequest.batchItemId ?? normalizedRequest.context?.batchItemId,
      groupId: normalizedRequest.groupId ?? normalizedRequest.context?.groupId,
    });

    const parsedConfig = CsvIngestorConfigSchema.safeParse(normalizedRequest.config ?? {});
    if (!parsedConfig.success) {
      const issues = toIngestionIssuesFromZodError(parsedConfig.error, CsvIngestorErrorCodes.invalidConfig, {
        category: IngestionIssueCategories.invalidConfiguration,
        source: contextToIssueSource(ingestionContext),
      });
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze(parsedConfig.error.issues.map((issue) => Object.freeze({
          code: CsvIngestorErrorCodes.invalidConfig,
          message: issue.message,
          path: issue.path.join("."),
        } satisfies CsvIngestorDiagnostic))),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: normalizedRequest.config,
        }),
      });
    }

    const config = parsedConfig.data;
    let normalizedContent: string;
    try {
      normalizedContent = decodePayload(normalizedRequest.payload, config.encoding);
    } catch (error) {
      const issues = Object.freeze([toIngestionIssueFromError({
        code: CsvIngestorErrorCodes.invalidEncoding,
        message: "CSV payload could not be decoded with the configured encoding.",
        error,
        category: IngestionIssueCategories.unreadableSource,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        retrySuggested: false,
        source: contextToIssueSource(ingestionContext),
      })]);
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
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
      });
    }

    const trimmed = normalizedContent.trim();
    if (!trimmed) {
      const issues = Object.freeze([createIngestionIssue({
        code: CsvIngestorErrorCodes.invalidCsv,
        message: "CSV content is empty.",
        category: IngestionIssueCategories.parseExtractionFailure,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code: CsvIngestorErrorCodes.invalidCsv,
          message: "CSV content is empty.",
        } satisfies CsvIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
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

        const output = normalizeRecordsOutput({
          records: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
          context: {
            ...ingestionContext,
            formatHint: "csv",
          },
          recordIdPrefix: "csv-record",
        });
        return Object.freeze({
          ok: true,
          config,
          records: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
          output,
          normalized: buildIngestionSuccessEnvelope({
            output,
            context: ingestionContext,
            asset: assetIdentity,
            configSummary: config,
          }),
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

      const normalizedRecords = Object.freeze(records);
      const output = normalizeRecordsOutput({
        records: normalizedRecords,
        context: {
          ...ingestionContext,
          formatHint: "csv",
        },
        recordIdPrefix: "csv-record",
      });
      return Object.freeze({
        ok: true,
        config,
        records: normalizedRecords,
        output,
        normalized: buildIngestionSuccessEnvelope({
          output,
          context: ingestionContext,
          asset: assetIdentity,
          configSummary: config,
        }),
        diagnostics: Object.freeze([]),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.includes("header")
        ? CsvIngestorErrorCodes.missingHeaders
        : CsvIngestorErrorCodes.invalidCsv;
      const issues = Object.freeze([toIngestionIssueFromError({
        code,
        message,
        error,
        category: IngestionIssueCategories.parseExtractionFailure,
        recoverability: IngestionIssueRecoverabilities.fixSource,
        retrySuggested: false,
        source: contextToIssueSource(ingestionContext),
      })]);
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([Object.freeze({
          code,
          message,
        } satisfies CsvIngestorDiagnostic)]),
        normalized: buildIngestionFailureEnvelope({
          context: ingestionContext,
          issues,
          asset: assetIdentity,
          configSummary: config,
        }),
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
    const schema = inferSchema(sample);
    const previewIssues = sample.length < result.records.length
      ? Object.freeze([createIngestionIssue({
        code: "csv-ingestor-preview-truncated",
        message: "Preview rows were truncated to keep preview execution bounded.",
        category: IngestionIssueCategories.previewFailure,
        severity: "warning",
        recoverability: IngestionIssueRecoverabilities.partial,
        source: contextToIssueSource(result.normalized.context),
        details: Object.freeze({
          totalCount: result.records.length,
          sampleCount: sample.length,
          maxRows: boundedMaxRows,
        }),
      })])
      : Object.freeze([]);
    return Object.freeze({
      records: sample,
      schema,
      totalCount: result.records.length,
      sampleCount: sample.length,
      normalized: buildIngestionPreviewEnvelope({
        ingestor: CsvIngestorAsset.assetId,
        context: result.normalized.context,
        asset: Object.freeze({
          assetId: CsvIngestorAsset.assetId,
          assetVersion: CsvIngestorAsset.assetVersion,
        }),
        configSummary: result.config as Readonly<Record<string, unknown>>,
        totalCount: result.records.length,
        sampleCount: sample.length,
        preview: result.normalized.preview,
        sample: sample,
        schema,
        issues: previewIssues,
      }),
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
        visibility: DataAssetConfigFieldVisibilities.simple,
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
        visibility: DataAssetConfigFieldVisibilities.simple,
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
        visibility: DataAssetConfigFieldVisibilities.advanced,
        required: true,
        defaultValue: "utf-8",
      },
      {
        key: "skipEmptyLines",
        label: "Skip empty lines",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
        defaultValue: true,
      },
      {
        key: "normalizeHeadersToLowercase",
        label: "Lowercase headers",
        kind: DataAssetConfigFieldKinds.boolean,
        visibility: DataAssetConfigFieldVisibilities.advanced,
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

