import type {
  CanonicalRecordPrimitiveValue,
  CanonicalRecordValue,
} from "../dataset-studio/CanonicalDataShapes";
import { ImageAssetReferenceKinds } from "../dataset-studio/contracts/ImageAssetReference";
import { createImageRecord, type ImageRecord } from "../dataset-studio/contracts/ImageRecord";

export interface DatasetInstanceImageStorageReference {
  readonly reference: string;
  readonly provider?: string;
}

export interface DatasetInstanceImageRecord {
  readonly recordId: string;
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly image: ImageRecord;
  readonly storage?: DatasetInstanceImageStorageReference;
  readonly metadata: Readonly<Record<string, CanonicalRecordValue>>;
  readonly admittedAt: string;
  readonly updatedAt: string;
}

export interface DatasetInstanceImageRecordQuery {
  readonly format?: string;
  readonly tag?: string;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly assetRefStableId?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordPrimitiveValue>>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | undefined, label: string): string {
  const normalized = normalizeOptional(value) ?? new Date().toISOString();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizeMetadata(
  metadata?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  if (!metadata) {
    return Object.freeze({});
  }
  const entries = Object.entries(metadata)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);
  return Object.freeze(Object.fromEntries(entries));
}

function normalizeStorage(
  storage?: DatasetInstanceImageStorageReference,
): DatasetInstanceImageStorageReference | undefined {
  if (!storage) {
    return undefined;
  }
  const reference = normalizeOptional(storage.reference);
  if (!reference) {
    return undefined;
  }
  return Object.freeze({
    reference,
    provider: normalizeOptional(storage.provider),
  });
}

function normalizeDimensionFilter(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

export function createDatasetInstanceImageRecord(input: {
  readonly recordId: string;
  readonly instanceId: string;
  readonly systemId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly image: ImageRecord;
  readonly storage?: DatasetInstanceImageStorageReference;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly admittedAt?: string;
  readonly updatedAt?: string;
}): DatasetInstanceImageRecord {
  const admittedAt = normalizeTimestamp(input.admittedAt, "DatasetInstanceImageRecord.admittedAt");
  const updatedAt = normalizeTimestamp(input.updatedAt, "DatasetInstanceImageRecord.updatedAt");
  if (updatedAt < admittedAt) {
    throw new Error("DatasetInstanceImageRecord.updatedAt cannot be earlier than admittedAt.");
  }

  return Object.freeze({
    recordId: normalizeRequired(input.recordId, "Dataset instance image record id"),
    instanceId: normalizeRequired(input.instanceId, "Dataset instance id"),
    systemId: normalizeRequired(input.systemId, "Dataset instance image record system id"),
    datasetAssetId: normalizeRequired(input.datasetAssetId, "Dataset asset id"),
    datasetAssetVersionId: normalizeOptional(input.datasetAssetVersionId),
    image: createImageRecord(input.image),
    storage: normalizeStorage(input.storage),
    metadata: normalizeMetadata(input.metadata),
    admittedAt,
    updatedAt,
  });
}

export function deriveStorageReferenceFromImageRecord(record: ImageRecord): string | undefined {
  if (record.assetRef.kind === ImageAssetReferenceKinds.localFile) {
    return record.assetRef.path;
  }
  if (record.assetRef.kind === ImageAssetReferenceKinds.externalUri) {
    return record.assetRef.uri;
  }
  if (record.assetRef.kind === ImageAssetReferenceKinds.canonicalAsset) {
    return record.assetRef.assetVersionId
      ? `${record.assetRef.assetId.toString()}@${record.assetRef.assetVersionId}`
      : record.assetRef.assetId.toString();
  }
  return record.assetRef.path ?? record.assetRef.outputId ?? record.assetRef.stableId;
}

export function normalizeDatasetInstanceImageRecordQuery(
  input?: DatasetInstanceImageRecordQuery,
): DatasetInstanceImageRecordQuery | undefined {
  if (!input) {
    return undefined;
  }

  const metadata = input.metadata
    ? Object.freeze(Object.fromEntries(
      Object.entries(input.metadata)
        .map(([key, value]) => [key.trim(), value] as const)
        .filter(([key]) => key.length > 0),
    ))
    : undefined;
  const normalized = Object.freeze({
    format: normalizeOptional(input.format)?.toLowerCase(),
    tag: normalizeOptional(input.tag),
    minWidth: normalizeDimensionFilter(input.minWidth, "query.minWidth"),
    maxWidth: normalizeDimensionFilter(input.maxWidth, "query.maxWidth"),
    minHeight: normalizeDimensionFilter(input.minHeight, "query.minHeight"),
    maxHeight: normalizeDimensionFilter(input.maxHeight, "query.maxHeight"),
    assetRefStableId: normalizeOptional(input.assetRefStableId),
    metadata,
  } satisfies DatasetInstanceImageRecordQuery);

  if (normalized.minWidth && normalized.maxWidth && normalized.minWidth > normalized.maxWidth) {
    throw new Error("query.minWidth cannot be greater than query.maxWidth.");
  }
  if (normalized.minHeight && normalized.maxHeight && normalized.minHeight > normalized.maxHeight) {
    throw new Error("query.minHeight cannot be greater than query.maxHeight.");
  }
  return normalized;
}

export function matchesDatasetInstanceImageRecordQuery(
  record: DatasetInstanceImageRecord,
  query?: DatasetInstanceImageRecordQuery,
): boolean {
  if (!query) {
    return true;
  }
  const normalized = normalizeDatasetInstanceImageRecordQuery(query);
  if (!normalized) {
    return true;
  }

  if (normalized.format && record.image.format.toLowerCase() !== normalized.format) {
    return false;
  }
  if (normalized.tag && !record.image.tags.includes(normalized.tag)) {
    return false;
  }
  if (normalized.minWidth !== undefined && record.image.width < normalized.minWidth) {
    return false;
  }
  if (normalized.maxWidth !== undefined && record.image.width > normalized.maxWidth) {
    return false;
  }
  if (normalized.minHeight !== undefined && record.image.height < normalized.minHeight) {
    return false;
  }
  if (normalized.maxHeight !== undefined && record.image.height > normalized.maxHeight) {
    return false;
  }
  if (normalized.assetRefStableId && record.image.assetRef.stableId !== normalized.assetRefStableId) {
    return false;
  }
  if (normalized.metadata) {
    for (const [key, expected] of Object.entries(normalized.metadata)) {
      if (record.image.metadata[key] !== expected) {
        return false;
      }
    }
  }
  return true;
}

