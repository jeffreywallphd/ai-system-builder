import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
  type CanonicalDataMetadata,
  type CanonicalDataShape,
  type CanonicalImageMetadataRecordsShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalRecordsShape,
  type CanonicalTableShape,
  type CanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataConverterDiagnosticSeverities,
  DataConverterInputBoundaryKinds,
  DataConverterOperationKinds,
  createDataConverterDiagnostic,
  mergeDataConverterMetadata,
  normalizeDataConverterContext,
  type DataConverterContractMetadata,
  type DataConverterDiagnostic,
  type DataConverterFailureResult,
  type DataConverterImageMetadataToRecordsRequest,
  type DataConverterOperationContext,
  type DataConverterRecordsToTableRequest,
  type DataConverterRequest,
  type DataConverterResult,
  type DataConverterResultBase,
  type DataConverterSourceToRecordsRequest,
  type DataConverterSuccessResult,
  type DataConverterDocumentToTextItemsRequest,
  type DataSourceReference,
  type ResolvedDataSource,
} from "./DataConverterContracts";
import { DefaultDataSourceLocator, DataSourceLocatorError, type IDataSourceLocator } from "./DataSourceLocator";
import { CsvIngestorAsset } from "./CsvIngestorAsset";
import { JsonIngestorAsset } from "./JsonIngestorAsset";
import {
  hasErrorIssues,
  toDataConverterDiagnostics,
  validateDataConverterRequest,
  validateDataConverterResult,
} from "./DataStudioValidation";

export const DataConverterErrorCodes = Object.freeze({
  invalidInput: "invalid_input",
  unsupportedContent: "unsupported_content",
  parseFailed: "parse_failed",
  invalidRequest: "invalid_request",
  sourceResolutionFailed: "source_resolution_failed",
} as const);

export type DataConverterErrorCode = typeof DataConverterErrorCodes[keyof typeof DataConverterErrorCodes];

export class DataConverterError extends Error {
  public readonly code: DataConverterErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: DataConverterErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "DataConverterError";
    this.code = code;
    this.details = details;
  }
}

export interface FileLikeSourcePayload {
  readonly fileName?: string;
  readonly contentType?: string;
  readonly formatHint?: "json" | "csv" | "tsv" | "text";
  readonly content:
    | string
    | Uint8Array
    | Readonly<Record<string, unknown>>
    | ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly delimiter?: "," | "\t" | ";" | "|";
  readonly hasHeaderRow?: boolean;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface RecordsToTableInput {
  readonly records: CanonicalRecordsShape | ReadonlyArray<CanonicalRecordItem>;
  readonly includeColumns?: ReadonlyArray<string>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}

export interface DocumentTextConversionInput {
  readonly documentId?: string;
  readonly text: string;
  readonly chunking?: {
    readonly mode: "line" | "paragraph" | "fixed-size";
    readonly size?: number;
    readonly overlap?: number;
  };
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

export interface ImageMetadataConversionInput {
  readonly imageId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function ensureCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => ensureCanonicalRecordValue(entry)));
  }

  if (typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Readonly<Record<string, unknown>>).map(([key, recordValue]) => [key, ensureCanonicalRecordValue(recordValue)]),
    ));
  }

  return String(value);
}

function toMetadata(input: {
  readonly fileName?: string;
  readonly contentType?: string;
  readonly format?: string;
  readonly sourceReference?: string;
  readonly sourceId?: string;
  readonly groupId?: string;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly converterId: string;
  readonly converterVersion: string;
  readonly operationId?: string;
  readonly base?: Partial<CanonicalDataMetadata>;
}): Partial<CanonicalDataMetadata> {
  const sourceAssetId = normalizeOptional(input.sourceAssetId);
  const sourceVersionId = normalizeOptional(input.sourceVersionId);
  const attributes = Object.fromEntries(
    Object.entries({
      ...(input.base?.attributes ?? {}),
      sourceReference: normalizeOptional(input.sourceReference),
      sourceId: normalizeOptional(input.sourceId),
      groupId: normalizeOptional(input.groupId),
    }).filter(([, value]) => value !== undefined),
  ) as Readonly<Record<string, CanonicalRecordValue>>;

  const base = Object.freeze({
    ...input.base,
    source: Object.freeze({
      ...(input.base?.source ?? {}),
      fileName: normalizeOptional(input.fileName) ?? input.base?.source?.fileName,
      contentType: normalizeOptional(input.contentType) ?? input.base?.source?.contentType,
      format: normalizeOptional(input.format) ?? input.base?.source?.format,
    }),
    attributes: Object.freeze(attributes),
    lineage: sourceAssetId
      ? Object.freeze([Object.freeze({
        assetId: sourceAssetId,
        versionId: sourceVersionId,
        relationship: "source" as const,
      })])
      : input.base?.lineage,
  });

  return mergeDataConverterMetadata({
    base,
    converterId: input.converterId,
    converterVersion: input.converterVersion,
    operationId: input.operationId,
  });
}

function normalizeStringContent(content: string | Uint8Array): string {
  if (typeof content === "string") {
    return content.replace(/\r\n/g, "\n");
  }

  return new TextDecoder().decode(content).replace(/\r\n/g, "\n");
}

function toRecordItems(records: ReadonlyArray<Readonly<Record<string, unknown>>>): ReadonlyArray<CanonicalRecordItem> {
  return Object.freeze(records.map((record, index) => {
    const fields = Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, ensureCanonicalRecordValue(value)]),
    );

    return Object.freeze({
      recordId: `record-${index + 1}`,
      fields: Object.freeze(fields),
    });
  }));
}

function inferValueType(value: CanonicalRecordValue): "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown" {
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

function toTableColumns(records: ReadonlyArray<CanonicalRecordItem>, includeColumns?: ReadonlyArray<string>) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record.fields)) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }

  const selected = includeColumns
    ? includeColumns.map((column) => column.trim()).filter((column) => column.length > 0 && seen.has(column))
    : ordered;

  return Object.freeze(selected.map((columnId) => {
    const firstValue = records.find((record) => columnId in record.fields)?.fields[columnId];
    return Object.freeze({
      columnId,
      label: columnId,
      valueType: firstValue === undefined ? "unknown" : inferValueType(firstValue),
    });
  }));
}

function buildContractMetadata(input: {
  readonly operation: DataConverterContractMetadata["operation"];
  readonly inputBoundary: DataConverterContractMetadata["inputBoundary"];
  readonly outputShapeKind: DataConverterContractMetadata["outputShapeKind"];
  readonly converterId: string;
  readonly converterVersion: string;
}): DataConverterContractMetadata {
  return Object.freeze({
    schemaVersion: "1.0.0",
    converterId: input.converterId,
    converterVersion: input.converterVersion,
    operation: input.operation,
    inputBoundary: input.inputBoundary,
    outputShapeKind: input.outputShapeKind,
  });
}

function buildFailureResult(
  operation: DataConverterRequest["operation"],
  context: DataConverterOperationContext,
  diagnostics: ReadonlyArray<DataConverterDiagnostic>,
): DataConverterFailureResult {
  return Object.freeze({
    ok: false,
    operation,
    context,
    diagnostics,
  });
}

export class DataConverterCore {
  private static readonly converterId = "dataset-studio-data-converter-core";
  private static readonly converterVersion = "1.0.0";
  private readonly csvIngestor = new CsvIngestorAsset();
  private readonly jsonIngestor = new JsonIngestorAsset();

  constructor(private readonly sourceLocator: IDataSourceLocator = new DefaultDataSourceLocator()) {}

  public convert(request: DataConverterRequest): DataConverterResult {
    const context = normalizeDataConverterContext(request.context);
    const requestIssues = validateDataConverterRequest(request);
    if (hasErrorIssues(requestIssues)) {
      return buildFailureResult(request.operation, context, toDataConverterDiagnostics(requestIssues));
    }

    try {
      let result: DataConverterResult;
      switch (request.operation) {
        case DataConverterOperationKinds.sourceToRecords:
          result = this.convertSourceToRecordsRequest(request, context);
          break;
        case DataConverterOperationKinds.recordsToTable:
          result = this.convertRecordsToTableRequest(request, context);
          break;
        case DataConverterOperationKinds.documentToTextItems:
          result = this.convertDocumentToTextItemsRequest(request, context);
          break;
        case DataConverterOperationKinds.imageMetadataToRecords:
          result = this.convertImageMetadataToRecordsRequest(request, context);
          break;
        default:
          throw new DataConverterError(DataConverterErrorCodes.invalidRequest, `Unsupported data converter operation '${request.operation}'.`);
      }

      const resultIssues = validateDataConverterResult(result);
      if (resultIssues.length === 0) {
        return result;
      }

      const issueDiagnostics = toDataConverterDiagnostics(resultIssues);
      if (!result.ok || hasErrorIssues(resultIssues)) {
        return buildFailureResult(
          request.operation,
          context,
          Object.freeze([
            ...result.diagnostics,
            ...issueDiagnostics,
          ]),
        );
      }

      return Object.freeze({
        ...result,
        diagnostics: Object.freeze([
          ...result.diagnostics,
          ...issueDiagnostics,
        ]),
      });
    } catch (error) {
      if (error instanceof DataConverterError) {
        return buildFailureResult(
          request.operation,
          context,
          Object.freeze([
            createDataConverterDiagnostic({
              code: error.code,
              severity: DataConverterDiagnosticSeverities.error,
              message: error.message,
              details: error.details,
            }),
          ]),
        );
      }

      return buildFailureResult(
        request.operation,
        context,
        Object.freeze([
          createDataConverterDiagnostic({
            code: DataConverterErrorCodes.invalidRequest,
            severity: DataConverterDiagnosticSeverities.error,
            message: error instanceof Error ? error.message : String(error),
          }),
        ]),
      );
    }
  }

  public async resolveAndConvertSourceToRecords(input: {
    readonly source: DataSourceReference;
    readonly context?: DataConverterOperationContext;
    readonly delimiter?: "," | "\t" | ";" | "|";
    readonly hasHeaderRow?: boolean;
    readonly formatHint?: "json" | "csv" | "tsv" | "text";
    readonly header?: boolean | "auto";
    readonly encoding?: string;
    readonly skipEmptyLines?: boolean;
    readonly normalizeHeadersToLowercase?: boolean;
    readonly flatten?: boolean;
    readonly maxDepth?: number;
  }): Promise<DataConverterResult> {
    const context = normalizeDataConverterContext(input.context);
    try {
      const resolved = await this.sourceLocator.resolve({ source: input.source, context });
      return this.convert({
        operation: DataConverterOperationKinds.sourceToRecords,
        context,
        source: resolved,
        delimiter: input.delimiter,
        hasHeaderRow: input.hasHeaderRow,
        formatHint: input.formatHint,
        header: input.header,
        encoding: input.encoding,
        skipEmptyLines: input.skipEmptyLines,
        normalizeHeadersToLowercase: input.normalizeHeadersToLowercase,
        flatten: input.flatten,
        maxDepth: input.maxDepth,
      });
    } catch (error) {
      if (error instanceof DataSourceLocatorError) {
        return buildFailureResult(
          DataConverterOperationKinds.sourceToRecords,
          context,
          Object.freeze([
            ...error.diagnostics,
            createDataConverterDiagnostic({
              code: DataConverterErrorCodes.sourceResolutionFailed,
              severity: DataConverterDiagnosticSeverities.error,
              message: error.message,
              details: { locatorCode: error.code },
            }),
          ]),
        );
      }

      return buildFailureResult(
        DataConverterOperationKinds.sourceToRecords,
        context,
        Object.freeze([
          createDataConverterDiagnostic({
            code: DataConverterErrorCodes.sourceResolutionFailed,
            severity: DataConverterDiagnosticSeverities.error,
            message: error instanceof Error ? error.message : String(error),
          }),
        ]),
      );
    }
  }

  public convertFileLikeSourceToRecords(input: FileLikeSourcePayload): CanonicalRecordsShape {
    const request: DataConverterSourceToRecordsRequest = Object.freeze({
      operation: DataConverterOperationKinds.sourceToRecords,
      source: Object.freeze({
        kind: "in-memory",
        reference: input.fileName ?? "legacy-file-like-source",
        payload: input.content,
        fileName: input.fileName,
        contentType: input.contentType,
        formatHint: input.formatHint,
        sourceAssetId: input.sourceAssetId,
        sourceVersionId: input.sourceVersionId,
        diagnostics: Object.freeze([]),
      }),
      formatHint: input.formatHint,
      delimiter: input.delimiter,
      hasHeaderRow: input.hasHeaderRow,
      encoding: "utf-8",
      skipEmptyLines: true,
      header: input.hasHeaderRow,
    });

    const result = this.convert(request);
    if (!result.ok) {
      throw new DataConverterError(
        (result.diagnostics[0]?.code as DataConverterErrorCode) ?? DataConverterErrorCodes.invalidRequest,
        result.diagnostics[0]?.message ?? "File-like source conversion failed.",
      );
    }

    return result.output;
  }

  public convertRecordsToTable(input: RecordsToTableInput): CanonicalTableShape {
    const result = this.convert({
      operation: DataConverterOperationKinds.recordsToTable,
      records: input.records,
      includeColumns: input.includeColumns,
      metadata: input.metadata,
    });

    if (!result.ok) {
      throw new DataConverterError(
        (result.diagnostics[0]?.code as DataConverterErrorCode) ?? DataConverterErrorCodes.invalidRequest,
        result.diagnostics[0]?.message ?? "Records-to-table conversion failed.",
      );
    }

    return result.output;
  }

  public convertDocumentToTextItems(input: DocumentTextConversionInput): CanonicalTextItemsShape {
    const result = this.convert({
      operation: DataConverterOperationKinds.documentToTextItems,
      documentId: input.documentId,
      text: input.text,
      chunking: input.chunking,
      sourceAssetId: input.sourceAssetId,
      sourceVersionId: input.sourceVersionId,
    });

    if (!result.ok) {
      throw new DataConverterError(
        (result.diagnostics[0]?.code as DataConverterErrorCode) ?? DataConverterErrorCodes.invalidRequest,
        result.diagnostics[0]?.message ?? "Document text conversion failed.",
      );
    }

    return result.output;
  }

  public convertImageMetadataToRecords(input: ImageMetadataConversionInput): CanonicalImageMetadataRecordsShape {
    const result = this.convert({
      operation: DataConverterOperationKinds.imageMetadataToRecords,
      imageId: input.imageId,
      metadata: input.metadata,
      sourceAssetId: input.sourceAssetId,
      sourceVersionId: input.sourceVersionId,
    });

    if (!result.ok) {
      throw new DataConverterError(
        (result.diagnostics[0]?.code as DataConverterErrorCode) ?? DataConverterErrorCodes.invalidRequest,
        result.diagnostics[0]?.message ?? "Image metadata conversion failed.",
      );
    }

    return result.output;
  }

  private convertSourceToRecordsRequest(
    request: DataConverterSourceToRecordsRequest,
    context: DataConverterOperationContext,
  ): DataConverterResultBase<CanonicalRecordsShape> {
    const source = request.source;
    if (source.payload === undefined || source.payload === null) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Resolved source content is required.");
    }

    let recordSource: ReadonlyArray<Readonly<Record<string, unknown>>>;
    const diagnostics: DataConverterDiagnostic[] = [...source.diagnostics];
    const formatHint = (request.formatHint ?? source.formatHint)?.toLowerCase();
    const delimiter = request.delimiter ?? (formatHint === "tsv" ? "\t" : ",");

    if (
      source.payload !== null
      && typeof source.payload === "object"
      && !Array.isArray(source.payload)
      && !(source.payload instanceof Uint8Array)
    ) {
      const jsonResult = this.jsonIngestor.execute({
        payload: Object.freeze({ ...source.payload }),
        config: {
          flatten: request.flatten ?? false,
          maxDepth: request.maxDepth,
        },
      });
      if (!jsonResult.ok) {
        throw new DataConverterError(
          DataConverterErrorCodes.parseFailed,
          jsonResult.diagnostics[0]?.message ?? "JSON ingestion failed.",
          { diagnostics: jsonResult.diagnostics },
        );
      }
      recordSource = jsonResult.records;
    } else if (Array.isArray(source.payload)) {
      const jsonResult = this.jsonIngestor.execute({
        payload: source.payload,
        config: {
          flatten: request.flatten ?? false,
          maxDepth: request.maxDepth,
        },
      });
      if (!jsonResult.ok) {
        throw new DataConverterError(
          DataConverterErrorCodes.parseFailed,
          jsonResult.diagnostics[0]?.message ?? "JSON ingestion failed.",
          { diagnostics: jsonResult.diagnostics },
        );
      }
      recordSource = jsonResult.records;
    } else if (source.payload instanceof Uint8Array || typeof source.payload === "string") {
      const normalizedText = normalizeStringContent(source.payload);
      if (!normalizedText.trim()) {
        throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Resolved source content cannot be empty.");
      }
      const looksLikeJson = normalizedText.trim().startsWith("{") || normalizedText.trim().startsWith("[");
      const shouldTreatAsDelimited = formatHint === "csv"
        || formatHint === "tsv"
        || formatHint === "text"
        || (!looksLikeJson && normalizedText.includes(delimiter));

      if (shouldTreatAsDelimited) {
        const csvResult = this.csvIngestor.execute({
          payload: source.payload,
          fileName: source.fileName,
          sourceAssetId: source.sourceAssetId,
          sourceVersionId: source.sourceVersionId,
          config: {
            delimiter,
            header: request.header ?? request.hasHeaderRow ?? "auto",
            encoding: request.encoding ?? "utf-8",
            skipEmptyLines: request.skipEmptyLines ?? true,
            normalizeHeadersToLowercase: request.normalizeHeadersToLowercase ?? false,
          },
        });
        if (!csvResult.ok) {
          throw new DataConverterError(
            DataConverterErrorCodes.parseFailed,
            csvResult.diagnostics[0]?.message ?? "CSV ingestion failed.",
            { diagnostics: csvResult.diagnostics },
          );
        }
        diagnostics.push(...csvResult.diagnostics.map((entry) => createDataConverterDiagnostic({
          code: entry.code,
          severity: DataConverterDiagnosticSeverities.warning,
          message: entry.message,
          path: entry.path,
          details: entry.details,
        })));
        recordSource = csvResult.records;
      } else {
        const jsonResult = this.jsonIngestor.execute({
          payload: source.payload,
          config: {
            flatten: request.flatten ?? false,
            maxDepth: request.maxDepth,
          },
        });
        if (!jsonResult.ok) {
          throw new DataConverterError(
            DataConverterErrorCodes.parseFailed,
            jsonResult.diagnostics[0]?.message ?? "JSON ingestion failed.",
            { diagnostics: jsonResult.diagnostics },
          );
        }
        diagnostics.push(...jsonResult.diagnostics.map((entry) => createDataConverterDiagnostic({
          code: entry.code,
          severity: DataConverterDiagnosticSeverities.warning,
          message: entry.message,
          path: entry.path,
          details: entry.details,
        })));
        recordSource = jsonResult.records;
      }
    } else {
      throw new DataConverterError(DataConverterErrorCodes.unsupportedContent, "Unsupported resolved source payload type.");
    }

    if (recordSource.length === 0) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Resolved source did not produce any records.");
    }

    const output = createCanonicalRecordsShape({
      records: toRecordItems(recordSource),
      metadata: toMetadata({
        fileName: source.fileName,
        contentType: source.contentType,
        format: formatHint ?? "structured",
        sourceReference: source.reference,
        sourceId: source.sourceId,
        groupId: source.groupId,
        sourceAssetId: source.sourceAssetId,
        sourceVersionId: source.sourceVersionId,
        converterId: DataConverterCore.converterId,
        converterVersion: DataConverterCore.converterVersion,
        operationId: context.operationId,
      }),
    });

    return this.buildSuccessResult({
      operation: request.operation,
      context,
      output,
      inputBoundary: DataConverterInputBoundaryKinds.resolvedSource,
      diagnostics: Object.freeze(diagnostics),
    });
  }

  private convertRecordsToTableRequest(
    request: DataConverterRecordsToTableRequest,
    context: DataConverterOperationContext,
  ): DataConverterResultBase<CanonicalTableShape> {
    const records = Array.isArray(request.records)
      ? request.records
      : request.records.records;

    const columns = toTableColumns(records, request.includeColumns);
    const rows = Object.freeze(records.map((record, index) => {
      const cells = Object.fromEntries(columns.map((column) => [column.columnId, record.fields[column.columnId] ?? null]));
      return Object.freeze({
        rowId: `row-${index + 1}`,
        sourceRecordId: record.recordId,
        cells: Object.freeze(cells),
      });
    }));

    const output = createCanonicalTableShape({
      columns,
      rows,
      metadata: toMetadata({
        converterId: DataConverterCore.converterId,
        converterVersion: DataConverterCore.converterVersion,
        operationId: context.operationId,
        base: request.metadata,
      }),
    });

    return this.buildSuccessResult({
      operation: request.operation,
      context,
      output,
      inputBoundary: DataConverterInputBoundaryKinds.canonicalRecords,
      diagnostics: Object.freeze([]),
    });
  }

  private convertDocumentToTextItemsRequest(
    request: DataConverterDocumentToTextItemsRequest,
    context: DataConverterOperationContext,
  ): DataConverterResultBase<CanonicalTextItemsShape> {
    const normalizedText = request.text.replace(/\r\n/g, "\n");
    if (!normalizedText.trim()) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Document text cannot be empty.");
    }

    const mode = request.chunking?.mode ?? "paragraph";
    const items: Array<{ text: string; startOffset: number; endOffset: number }> = [];

    if (mode === "line") {
      let offset = 0;
      for (const line of normalizedText.split("\n")) {
        const startOffset = offset;
        const endOffset = offset + line.length;
        if (line.trim().length > 0) {
          items.push({ text: line, startOffset, endOffset });
        }
        offset = endOffset + 1;
      }
    } else if (mode === "fixed-size") {
      const size = Math.max(1, request.chunking?.size ?? 500);
      const overlap = Math.max(0, Math.min(size - 1, request.chunking?.overlap ?? 0));
      let cursor = 0;
      while (cursor < normalizedText.length) {
        const end = Math.min(normalizedText.length, cursor + size);
        const segment = normalizedText.slice(cursor, end);
        if (segment.trim().length > 0) {
          items.push({ text: segment, startOffset: cursor, endOffset: end });
        }
        if (end >= normalizedText.length) {
          break;
        }
        cursor = end - overlap;
      }
    } else {
      let cursor = 0;
      for (const paragraph of normalizedText.split(/\n\s*\n/)) {
        const text = paragraph.trim();
        if (!text) {
          cursor += paragraph.length + 2;
          continue;
        }
        const startOffset = normalizedText.indexOf(text, cursor);
        const endOffset = startOffset + text.length;
        items.push({ text, startOffset, endOffset });
        cursor = endOffset;
      }
    }

    const output = createCanonicalTextItemsShape({
      items: Object.freeze(items.map((item, index) => Object.freeze({
        itemId: `text-item-${index + 1}`,
        text: item.text,
        sourceDocumentId: normalizeOptional(request.documentId),
        startOffset: item.startOffset,
        endOffset: item.endOffset,
      }))),
      metadata: toMetadata({
        format: "text",
        sourceAssetId: request.sourceAssetId,
        sourceVersionId: request.sourceVersionId,
        converterId: DataConverterCore.converterId,
        converterVersion: DataConverterCore.converterVersion,
        operationId: context.operationId,
      }),
    });

    return this.buildSuccessResult({
      operation: request.operation,
      context,
      output,
      inputBoundary: DataConverterInputBoundaryKinds.documentText,
      diagnostics: Object.freeze([]),
    });
  }

  private convertImageMetadataToRecordsRequest(
    request: DataConverterImageMetadataToRecordsRequest,
    context: DataConverterOperationContext,
  ): DataConverterResultBase<CanonicalImageMetadataRecordsShape> {
    if (!request.metadata || typeof request.metadata !== "object") {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Image metadata must be an object.");
    }

    const regions = Array.isArray(request.metadata.regions)
      ? request.metadata.regions.filter((entry) => entry && typeof entry === "object") as Array<Readonly<Record<string, unknown>>>
      : [];

    const regionItems = (regions.length > 0 ? regions : [request.metadata]).map((entry, index) => {
      const x = typeof entry.x === "number" ? entry.x : undefined;
      const y = typeof entry.y === "number" ? entry.y : undefined;
      const width = typeof entry.width === "number" ? entry.width : undefined;
      const height = typeof entry.height === "number" ? entry.height : undefined;
      const attributes = Object.fromEntries(
        Object.entries(entry)
          .filter(([key]) => !["id", "label", "confidence", "x", "y", "width", "height", "boundingBox"].includes(key))
          .map(([key, value]) => [key, ensureCanonicalRecordValue(value)]),
      );
      const confidence = typeof entry.confidence === "number" ? entry.confidence : undefined;

      return Object.freeze({
        itemId: normalizeOptional(typeof entry.id === "string" ? entry.id : undefined) ?? `image-item-${index + 1}`,
        imageId: normalizeOptional(request.imageId),
        label: normalizeOptional(typeof entry.label === "string" ? entry.label : undefined),
        confidence,
        boundingBox:
          x !== undefined && y !== undefined && width !== undefined && height !== undefined
            ? Object.freeze({ x, y, width, height })
            : undefined,
        attributes: Object.freeze(attributes),
      });
    });

    const output = createCanonicalImageMetadataRecordsShape({
      items: Object.freeze(regionItems),
      metadata: toMetadata({
        format: "image-metadata",
        sourceAssetId: request.sourceAssetId,
        sourceVersionId: request.sourceVersionId,
        converterId: DataConverterCore.converterId,
        converterVersion: DataConverterCore.converterVersion,
        operationId: context.operationId,
      }),
    });

    return this.buildSuccessResult({
      operation: request.operation,
      context,
      output,
      inputBoundary: DataConverterInputBoundaryKinds.imageMetadata,
      diagnostics: Object.freeze([]),
    });
  }

  private buildSuccessResult<TShape extends CanonicalDataShape>(input: {
    readonly operation: DataConverterRequest["operation"];
    readonly context: DataConverterOperationContext;
    readonly output: TShape;
    readonly inputBoundary: DataConverterContractMetadata["inputBoundary"];
    readonly diagnostics: ReadonlyArray<DataConverterDiagnostic>;
  }): DataConverterResultBase<TShape> {
    return Object.freeze({
      ok: true,
      operation: input.operation,
      context: input.context,
      contract: buildContractMetadata({
        operation: input.operation,
        inputBoundary: input.inputBoundary,
        outputShapeKind: input.output.kind,
        converterId: DataConverterCore.converterId,
        converterVersion: DataConverterCore.converterVersion,
      }),
      metadata: input.output.metadata,
      output: input.output,
      diagnostics: input.diagnostics,
    });
  }
}

export type {
  DataConverterOperationContext,
  DataConverterRequest,
  DataConverterResult,
  DataConverterSuccessResult,
  DataConverterFailureResult,
  ResolvedDataSource,
};
