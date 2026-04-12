export const CanonicalDataShapeKinds = Object.freeze({
  records: "records",
  table: "table",
  textItems: "text-items",
  imageMetadataRecords: "image-metadata-records",
} as const);

export type CanonicalDataShapeKind = typeof CanonicalDataShapeKinds[keyof typeof CanonicalDataShapeKinds];

export type CanonicalRecordPrimitiveValue = string | number | boolean | null;
export type CanonicalRecordValue =
  | CanonicalRecordPrimitiveValue
  | ReadonlyArray<CanonicalRecordValue>
  | Readonly<Record<string, CanonicalRecordValue>>;

export interface CanonicalDataLineageReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relationship: "source" | "derived-from" | "transformed-from" | "document-segment" | "image-region";
}

export interface CanonicalDataMetadata {
  readonly schemaVersion: string;
  readonly source?: {
    readonly fileName?: string;
    readonly contentType?: string;
    readonly format?: string;
  };
  readonly lineage?: ReadonlyArray<CanonicalDataLineageReference>;
  readonly transformation?: {
    readonly transformationId?: string;
    readonly converterId?: string;
    readonly converterVersion?: string;
  };
  readonly preview?: {
    readonly sampleCount?: number;
    readonly sampleRecordIds?: ReadonlyArray<string>;
  };
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface CanonicalDataShapeBase {
  readonly kind: CanonicalDataShapeKind;
  readonly metadata: CanonicalDataMetadata;
}

export interface CanonicalRecordItem {
  readonly recordId: string;
  readonly fields: Readonly<Record<string, CanonicalRecordValue>>;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface CanonicalRecordsShape extends CanonicalDataShapeBase {
  readonly kind: typeof CanonicalDataShapeKinds.records;
  readonly records: ReadonlyArray<CanonicalRecordItem>;
}

export interface CanonicalTableColumn {
  readonly columnId: string;
  readonly label: string;
  readonly valueType: "string" | "number" | "boolean" | "object" | "array" | "null" | "unknown";
}

export interface CanonicalTableRow {
  readonly rowId: string;
  readonly cells: Readonly<Record<string, CanonicalRecordValue>>;
  readonly sourceRecordId?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface CanonicalTableShape extends CanonicalDataShapeBase {
  readonly kind: typeof CanonicalDataShapeKinds.table;
  readonly columns: ReadonlyArray<CanonicalTableColumn>;
  readonly rows: ReadonlyArray<CanonicalTableRow>;
}

export interface CanonicalTextItem {
  readonly itemId: string;
  readonly text: string;
  readonly sourceDocumentId?: string;
  readonly startOffset?: number;
  readonly endOffset?: number;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface CanonicalTextItemsShape extends CanonicalDataShapeBase {
  readonly kind: typeof CanonicalDataShapeKinds.textItems;
  readonly items: ReadonlyArray<CanonicalTextItem>;
}

export interface CanonicalImageBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanonicalImageStructuredItem {
  readonly itemId: string;
  readonly imageId?: string;
  readonly label?: string;
  readonly confidence?: number;
  readonly boundingBox?: CanonicalImageBoundingBox;
  readonly attributes?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface CanonicalImageMetadataRecordsShape extends CanonicalDataShapeBase {
  readonly kind: typeof CanonicalDataShapeKinds.imageMetadataRecords;
  readonly items: ReadonlyArray<CanonicalImageStructuredItem>;
}

export type CanonicalDataShape =
  | CanonicalRecordsShape
  | CanonicalTableShape
  | CanonicalTextItemsShape
  | CanonicalImageMetadataRecordsShape;

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRecordRecord(
  input?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input).filter(([key]) => key.trim().length > 0);
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function normalizeLineage(
  lineage?: ReadonlyArray<CanonicalDataLineageReference>,
): ReadonlyArray<CanonicalDataLineageReference> | undefined {
  if (!lineage) {
    return undefined;
  }

  const normalized = lineage
    .map((entry) => {
      const assetId = entry.assetId.trim();
      if (!assetId) {
        throw new Error("Canonical data lineage references require a non-empty assetId.");
      }

      return Object.freeze({
        assetId,
        versionId: normalizeOptional(entry.versionId),
        relationship: entry.relationship,
      });
    });

  return Object.freeze(normalized);
}

function assertIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }

  return normalized;
}

function assertNonNegativeInteger(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }

  return value;
}

function freezeArray<T>(values?: ReadonlyArray<T>): ReadonlyArray<T> | undefined {
  return values ? Object.freeze([...values]) : undefined;
}

export function normalizeCanonicalDataMetadata(
  metadata?: Partial<CanonicalDataMetadata>,
): CanonicalDataMetadata {
  const schemaVersion = normalizeOptional(metadata?.schemaVersion) ?? "1.0.0";
  if (!schemaVersion) {
    throw new Error("Canonical data metadata requires a schemaVersion.");
  }

  return Object.freeze({
    schemaVersion,
    source: metadata?.source
      ? Object.freeze({
        fileName: normalizeOptional(metadata.source.fileName),
        contentType: normalizeOptional(metadata.source.contentType)?.toLowerCase(),
        format: normalizeOptional(metadata.source.format)?.toLowerCase(),
      })
      : undefined,
    lineage: normalizeLineage(metadata?.lineage),
    transformation: metadata?.transformation
      ? Object.freeze({
        transformationId: normalizeOptional(metadata.transformation.transformationId),
        converterId: normalizeOptional(metadata.transformation.converterId),
        converterVersion: normalizeOptional(metadata.transformation.converterVersion),
      })
      : undefined,
    preview: metadata?.preview
      ? Object.freeze({
        sampleCount: metadata.preview.sampleCount,
        sampleRecordIds: freezeArray(
          metadata.preview.sampleRecordIds?.map((id) => assertIdentifier(id, "preview.sampleRecordIds entry")),
        ),
      })
      : undefined,
    attributes: normalizeRecordRecord(metadata?.attributes),
  });
}

export function isCanonicalRecordValue(value: unknown): value is CanonicalRecordValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isCanonicalRecordValue(entry));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((entry) => isCanonicalRecordValue(entry));
  }

  return false;
}

function normalizeFieldRecord(input: Readonly<Record<string, unknown>>, label: string): Readonly<Record<string, CanonicalRecordValue>> {
  const normalized: Record<string, CanonicalRecordValue> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    if (!isCanonicalRecordValue(value)) {
      throw new Error(`${label}.${normalizedKey} is not a canonical record value.`);
    }
    normalized[normalizedKey] = value;
  }
  return Object.freeze(normalized);
}

export function createCanonicalRecordsShape(input: {
  readonly records: ReadonlyArray<CanonicalRecordItem>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}): CanonicalRecordsShape {
  const records = input.records.map((record) => Object.freeze({
    recordId: assertIdentifier(record.recordId, "CanonicalRecordItem.recordId"),
    fields: normalizeFieldRecord(record.fields, "CanonicalRecordItem.fields"),
    metadata: record.metadata ? normalizeFieldRecord(record.metadata, "CanonicalRecordItem.metadata") : undefined,
  }));

  return Object.freeze({
    kind: CanonicalDataShapeKinds.records,
    records: Object.freeze(records),
    metadata: normalizeCanonicalDataMetadata(input.metadata),
  });
}

export function createCanonicalTableShape(input: {
  readonly columns: ReadonlyArray<CanonicalTableColumn>;
  readonly rows: ReadonlyArray<CanonicalTableRow>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}): CanonicalTableShape {
  const columns = input.columns.map((column) => Object.freeze({
    columnId: assertIdentifier(column.columnId, "CanonicalTableColumn.columnId"),
    label: assertIdentifier(column.label, "CanonicalTableColumn.label"),
    valueType: column.valueType,
  }));

  const allowedColumns = new Set(columns.map((column) => column.columnId));
  const rows = input.rows.map((row) => {
    const rowId = assertIdentifier(row.rowId, "CanonicalTableRow.rowId");
    const sourceRecordId = normalizeOptional(row.sourceRecordId);
    const entries = Object.entries(row.cells);
    for (const [columnId, value] of entries) {
      if (!allowedColumns.has(columnId)) {
        throw new Error(`CanonicalTableRow '${rowId}' includes unknown column '${columnId}'.`);
      }
      if (!isCanonicalRecordValue(value)) {
        throw new Error(`CanonicalTableRow '${rowId}' includes a non-canonical value for '${columnId}'.`);
      }
    }

    return Object.freeze({
      rowId,
      sourceRecordId,
      cells: Object.freeze(Object.fromEntries(entries)),
      metadata: row.metadata ? normalizeFieldRecord(row.metadata, "CanonicalTableRow.metadata") : undefined,
    });
  });

  return Object.freeze({
    kind: CanonicalDataShapeKinds.table,
    columns: Object.freeze(columns),
    rows: Object.freeze(rows),
    metadata: normalizeCanonicalDataMetadata(input.metadata),
  });
}

export function createCanonicalTextItemsShape(input: {
  readonly items: ReadonlyArray<CanonicalTextItem>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}): CanonicalTextItemsShape {
  const items = input.items.map((item) => {
    const itemId = assertIdentifier(item.itemId, "CanonicalTextItem.itemId");
    const text = assertIdentifier(item.text, "CanonicalTextItem.text");
    const startOffset = assertNonNegativeInteger(item.startOffset, "CanonicalTextItem.startOffset");
    const endOffset = assertNonNegativeInteger(item.endOffset, "CanonicalTextItem.endOffset");
    if (startOffset !== undefined && endOffset !== undefined && endOffset < startOffset) {
      throw new Error(`CanonicalTextItem '${itemId}' has endOffset earlier than startOffset.`);
    }

    return Object.freeze({
      itemId,
      text,
      sourceDocumentId: normalizeOptional(item.sourceDocumentId),
      startOffset,
      endOffset,
      metadata: item.metadata ? normalizeFieldRecord(item.metadata, "CanonicalTextItem.metadata") : undefined,
    });
  });

  return Object.freeze({
    kind: CanonicalDataShapeKinds.textItems,
    items: Object.freeze(items),
    metadata: normalizeCanonicalDataMetadata(input.metadata),
  });
}

export function createCanonicalImageMetadataRecordsShape(input: {
  readonly items: ReadonlyArray<CanonicalImageStructuredItem>;
  readonly metadata?: Partial<CanonicalDataMetadata>;
}): CanonicalImageMetadataRecordsShape {
  const items = input.items.map((item) => {
    const confidence = item.confidence;
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      throw new Error("CanonicalImageStructuredItem.confidence must be between 0 and 1.");
    }

    const box = item.boundingBox
      ? Object.freeze({
        x: item.boundingBox.x,
        y: item.boundingBox.y,
        width: item.boundingBox.width,
        height: item.boundingBox.height,
      })
      : undefined;

    if (box && (box.width < 0 || box.height < 0)) {
      throw new Error("CanonicalImageStructuredItem.boundingBox width/height cannot be negative.");
    }

    return Object.freeze({
      itemId: assertIdentifier(item.itemId, "CanonicalImageStructuredItem.itemId"),
      imageId: normalizeOptional(item.imageId),
      label: normalizeOptional(item.label),
      confidence,
      boundingBox: box,
      attributes: item.attributes ? normalizeFieldRecord(item.attributes, "CanonicalImageStructuredItem.attributes") : undefined,
      metadata: item.metadata ? normalizeFieldRecord(item.metadata, "CanonicalImageStructuredItem.metadata") : undefined,
    });
  });

  return Object.freeze({
    kind: CanonicalDataShapeKinds.imageMetadataRecords,
    items: Object.freeze(items),
    metadata: normalizeCanonicalDataMetadata(input.metadata),
  });
}

export function isCanonicalDataShape(value: unknown): value is CanonicalDataShape {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CanonicalDataShape>;
  if (!candidate.kind || !candidate.metadata) {
    return false;
  }

  return Object.values(CanonicalDataShapeKinds).includes(candidate.kind as CanonicalDataShapeKind);
}

