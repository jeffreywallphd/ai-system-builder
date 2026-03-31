import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
  type CanonicalDataMetadata,
  type CanonicalImageMetadataRecordsShape,
  type CanonicalRecordItem,
  type CanonicalRecordValue,
  type CanonicalRecordsShape,
  type CanonicalTableShape,
  type CanonicalTextItemsShape,
} from "../../domain/dataset-studio/CanonicalDataShapes";

export const DataConverterErrorCodes = Object.freeze({
  invalidInput: "invalid_input",
  unsupportedContent: "unsupported_content",
  parseFailed: "parse_failed",
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
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly converterId: string;
}): Partial<CanonicalDataMetadata> {
  const sourceAssetId = normalizeOptional(input.sourceAssetId);
  const sourceVersionId = normalizeOptional(input.sourceVersionId);
  return Object.freeze({
    schemaVersion: "1.0.0",
    source: Object.freeze({
      fileName: normalizeOptional(input.fileName),
      contentType: normalizeOptional(input.contentType),
      format: normalizeOptional(input.format),
    }),
    lineage: sourceAssetId
      ? Object.freeze([Object.freeze({
        assetId: sourceAssetId,
        versionId: sourceVersionId,
        relationship: "source" as const,
      })])
      : undefined,
    transformation: Object.freeze({
      converterId: input.converterId,
      converterVersion: "1.0.0",
    }),
  });
}

function normalizeStringContent(content: string | Uint8Array): string {
  if (typeof content === "string") {
    return content.replace(/\r\n/g, "\n");
  }

  return new TextDecoder().decode(content).replace(/\r\n/g, "\n");
}

function parseDelimitedContent(content: string, delimiter: string, hasHeaderRow: boolean): ReadonlyArray<Readonly<Record<string, unknown>>> {
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return Object.freeze([]);
  }

  const splitRow = (line: string) => line.split(delimiter).map((cell) => cell.trim());
  const firstRow = splitRow(lines[0]);
  const columns = hasHeaderRow
    ? firstRow.map((value, index) => value || `column_${index + 1}`)
    : firstRow.map((_, index) => `column_${index + 1}`);
  const dataRows = hasHeaderRow ? lines.slice(1) : lines;

  const parsed = dataRows.map((line) => {
    const cells = splitRow(line);
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      record[column] = cells[index] ?? "";
    });
    return Object.freeze(record);
  });

  return Object.freeze(parsed);
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

function parseStructuredContent(content: string): ReadonlyArray<Readonly<Record<string, unknown>>> {
  const trimmed = content.trim();
  if (!trimmed) {
    return Object.freeze([]);
  }

  const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksLikeJson) {
    throw new DataConverterError(
      DataConverterErrorCodes.unsupportedContent,
      "String payload does not look like JSON or delimited text.",
    );
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      const records = parsed.filter((entry) => entry && typeof entry === "object") as ReadonlyArray<Readonly<Record<string, unknown>>>;
      if (records.length !== parsed.length) {
        throw new DataConverterError(
          DataConverterErrorCodes.parseFailed,
          "JSON array payload must contain only object records.",
        );
      }
      return Object.freeze(records.map((entry) => Object.freeze({ ...entry })));
    }

    if (parsed && typeof parsed === "object") {
      return Object.freeze([Object.freeze(parsed as Readonly<Record<string, unknown>>)]);
    }

    throw new DataConverterError(
      DataConverterErrorCodes.parseFailed,
      "JSON payload must be an object or array of objects.",
    );
  } catch (error) {
    if (error instanceof DataConverterError) {
      throw error;
    }

    throw new DataConverterError(
      DataConverterErrorCodes.parseFailed,
      "Failed to parse JSON payload for record conversion.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
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

export class DataConverterCore {
  private static readonly converterId = "dataset-studio-data-converter-core";

  public convertFileLikeSourceToRecords(input: FileLikeSourcePayload): CanonicalRecordsShape {
    if (input.content === undefined || input.content === null) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "File-like source content is required.");
    }

    let recordSource: ReadonlyArray<Readonly<Record<string, unknown>>>;
    const formatHint = input.formatHint?.toLowerCase();
    const delimiter = input.delimiter ?? (formatHint === "tsv" ? "\t" : ",");

    if (Array.isArray(input.content)) {
      recordSource = Object.freeze(input.content.map((entry) => Object.freeze({ ...entry })));
    } else if (input.content instanceof Uint8Array) {
      const normalizedText = normalizeStringContent(input.content);
      if (!normalizedText.trim()) {
        throw new DataConverterError(DataConverterErrorCodes.invalidInput, "File-like source content cannot be empty.");
      }
      if (formatHint === "csv" || formatHint === "tsv" || formatHint === "text") {
        recordSource = parseDelimitedContent(normalizedText, delimiter, input.hasHeaderRow ?? true);
      } else {
        recordSource = parseStructuredContent(normalizedText);
      }
    } else if (typeof input.content === "string") {
      const normalizedText = normalizeStringContent(input.content);
      if (!normalizedText.trim()) {
        throw new DataConverterError(DataConverterErrorCodes.invalidInput, "File-like source content cannot be empty.");
      }
      const looksLikeJson = normalizedText.trim().startsWith("{") || normalizedText.trim().startsWith("[");
      const looksLikeDelimited = normalizedText.includes("\n") && normalizedText.includes(delimiter);
      if (formatHint === "csv" || formatHint === "tsv" || formatHint === "text" || (!looksLikeJson && looksLikeDelimited)) {
        recordSource = parseDelimitedContent(normalizedText, delimiter, input.hasHeaderRow ?? true);
      } else {
        recordSource = parseStructuredContent(normalizedText);
      }
    } else if (typeof input.content === "object") {
      recordSource = Object.freeze([Object.freeze({ ...input.content })]);
    } else {
      throw new DataConverterError(DataConverterErrorCodes.unsupportedContent, "Unsupported file-like content type.");
    }
    if (recordSource.length === 0) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "File-like source did not produce any records.");
    }

    return createCanonicalRecordsShape({
      records: toRecordItems(recordSource),
      metadata: toMetadata({
        fileName: input.fileName,
        contentType: input.contentType,
        format: formatHint ?? "structured",
        sourceAssetId: input.sourceAssetId,
        sourceVersionId: input.sourceVersionId,
        converterId: DataConverterCore.converterId,
      }),
    });
  }

  public convertRecordsToTable(input: RecordsToTableInput): CanonicalTableShape {
    const records = Array.isArray(input.records)
      ? input.records
      : input.records.records;

    const columns = toTableColumns(records, input.includeColumns);
    const rows = Object.freeze(records.map((record, index) => {
      const cells = Object.fromEntries(columns.map((column) => [column.columnId, record.fields[column.columnId] ?? null]));
      return Object.freeze({
        rowId: `row-${index + 1}`,
        sourceRecordId: record.recordId,
        cells: Object.freeze(cells),
      });
    }));

    return createCanonicalTableShape({
      columns,
      rows,
      metadata: {
        ...input.metadata,
        transformation: Object.freeze({
          converterId: DataConverterCore.converterId,
          converterVersion: "1.0.0",
        }),
      },
    });
  }

  public convertDocumentToTextItems(input: DocumentTextConversionInput): CanonicalTextItemsShape {
    const normalizedText = input.text.replace(/\r\n/g, "\n");
    if (!normalizedText.trim()) {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Document text cannot be empty.");
    }

    const mode = input.chunking?.mode ?? "paragraph";
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
      const size = Math.max(1, input.chunking?.size ?? 500);
      const overlap = Math.max(0, Math.min(size - 1, input.chunking?.overlap ?? 0));
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

    return createCanonicalTextItemsShape({
      items: Object.freeze(items.map((item, index) => Object.freeze({
        itemId: `text-item-${index + 1}`,
        text: item.text,
        sourceDocumentId: normalizeOptional(input.documentId),
        startOffset: item.startOffset,
        endOffset: item.endOffset,
      }))),
      metadata: toMetadata({
        format: "text",
        sourceAssetId: input.sourceAssetId,
        sourceVersionId: input.sourceVersionId,
        converterId: DataConverterCore.converterId,
      }),
    });
  }

  public convertImageMetadataToRecords(input: ImageMetadataConversionInput): CanonicalImageMetadataRecordsShape {
    if (!input.metadata || typeof input.metadata !== "object") {
      throw new DataConverterError(DataConverterErrorCodes.invalidInput, "Image metadata must be an object.");
    }

    const regions = Array.isArray(input.metadata.regions)
      ? input.metadata.regions.filter((entry) => entry && typeof entry === "object") as Array<Readonly<Record<string, unknown>>>
      : [];

    const regionItems = (regions.length > 0 ? regions : [input.metadata]).map((entry, index) => {
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
        imageId: normalizeOptional(input.imageId),
        label: normalizeOptional(typeof entry.label === "string" ? entry.label : undefined),
        confidence,
        boundingBox:
          x !== undefined && y !== undefined && width !== undefined && height !== undefined
            ? Object.freeze({ x, y, width, height })
            : undefined,
        attributes: Object.freeze(attributes),
      });
    });

    return createCanonicalImageMetadataRecordsShape({
      items: Object.freeze(regionItems),
      metadata: toMetadata({
        format: "image-metadata",
        sourceAssetId: input.sourceAssetId,
        sourceVersionId: input.sourceVersionId,
        converterId: DataConverterCore.converterId,
      }),
    });
  }
}
