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
  readonly provenance: DatasetInstanceImageRecordProvenance;
  readonly admittedAt: string;
  readonly updatedAt: string;
  readonly mutationVersion: number;
}

export interface DatasetInstanceImageRecordProvenance {
  readonly sourceType?: string;
  readonly sourceReference?: string;
  readonly sourceSystemId?: string;
  readonly sourceRunId?: string;
  readonly ingestedBy?: string;
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

export interface DatasetInstanceImageRecordMetadataPatch {
  readonly set?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly remove?: ReadonlyArray<string>;
  readonly replace?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DatasetInstanceImageRecordStoragePatch {
  readonly reference?: string | null;
  readonly provider?: string | null;
}

export interface DatasetInstanceImagePatch {
  readonly assetRef?: ImageRecord["assetRef"];
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly mimeType?: string | null;
  readonly metadataPatch?: DatasetInstanceImageRecordMetadataPatch;
  readonly tags?: ReadonlyArray<string>;
  readonly derived?: Readonly<Record<string, CanonicalRecordValue>> | null;
  readonly annotations?: Readonly<Record<string, CanonicalRecordValue>> | null;
  readonly schemaVersion?: string | null;
}

export interface DatasetInstanceImageRecordPatch {
  readonly imagePatch?: DatasetInstanceImagePatch;
  readonly metadataPatch?: DatasetInstanceImageRecordMetadataPatch;
  readonly provenancePatch?: DatasetInstanceImageRecordProvenancePatch;
  readonly storagePatch?: DatasetInstanceImageRecordStoragePatch | null;
  readonly updatedAt?: string;
}

export interface DatasetInstanceImageRecordProvenancePatch {
  readonly sourceType?: string | null;
  readonly sourceReference?: string | null;
  readonly sourceSystemId?: string | null;
  readonly sourceRunId?: string | null;
  readonly ingestedBy?: string | null;
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

function normalizeProvenance(
  provenance?: DatasetInstanceImageRecordProvenance,
): DatasetInstanceImageRecordProvenance {
  return Object.freeze({
    sourceType: normalizeOptional(provenance?.sourceType),
    sourceReference: normalizeOptional(provenance?.sourceReference),
    sourceSystemId: normalizeOptional(provenance?.sourceSystemId),
    sourceRunId: normalizeOptional(provenance?.sourceRunId),
    ingestedBy: normalizeOptional(provenance?.ingestedBy),
  });
}

function applyMetadataPatch(
  current: Readonly<Record<string, CanonicalRecordValue>>,
  patch?: DatasetInstanceImageRecordMetadataPatch,
): Readonly<Record<string, CanonicalRecordValue>> {
  if (!patch) {
    return current;
  }
  if (patch.replace) {
    return normalizeMetadata(patch.replace);
  }

  const next: Record<string, CanonicalRecordValue> = { ...current };
  if (patch.set) {
    for (const [rawKey, value] of Object.entries(patch.set)) {
      const key = rawKey.trim();
      if (key) {
        next[key] = value;
      }
    }
  }
  if (patch.remove) {
    for (const rawKey of patch.remove) {
      const key = rawKey.trim();
      if (key) {
        delete next[key];
      }
    }
  }
  return normalizeMetadata(next);
}

function normalizeMutationVersion(value: number | undefined): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("DatasetInstanceImageRecord.mutationVersion must be a positive integer.");
  }
  return value;
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
  readonly provenance?: DatasetInstanceImageRecordProvenance;
  readonly admittedAt?: string;
  readonly updatedAt?: string;
  readonly mutationVersion?: number;
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
    provenance: normalizeProvenance(input.provenance),
    admittedAt,
    updatedAt,
    mutationVersion: normalizeMutationVersion(input.mutationVersion),
  });
}

export function patchDatasetInstanceImageRecord(input: {
  readonly record: DatasetInstanceImageRecord;
  readonly patch: DatasetInstanceImageRecordPatch;
}): DatasetInstanceImageRecord {
  const nextUpdatedAt = normalizeTimestamp(input.patch.updatedAt, "DatasetInstanceImageRecord.updatedAt");
  if (nextUpdatedAt < input.record.admittedAt) {
    throw new Error("DatasetInstanceImageRecord.updatedAt cannot be earlier than admittedAt.");
  }
  if (nextUpdatedAt < input.record.updatedAt) {
    throw new Error("DatasetInstanceImageRecord.updatedAt cannot move backwards.");
  }

  const nextMetadata = applyMetadataPatch(input.record.metadata, input.patch.metadataPatch);
  const currentProvenance = input.record.provenance;
  const patchProvenance = input.patch.provenancePatch;
  const nextProvenance = patchProvenance
    ? normalizeProvenance({
      sourceType: patchProvenance.sourceType === null ? undefined : patchProvenance.sourceType ?? currentProvenance.sourceType,
      sourceReference: patchProvenance.sourceReference === null
        ? undefined
        : patchProvenance.sourceReference ?? currentProvenance.sourceReference,
      sourceSystemId: patchProvenance.sourceSystemId === null
        ? undefined
        : patchProvenance.sourceSystemId ?? currentProvenance.sourceSystemId,
      sourceRunId: patchProvenance.sourceRunId === null
        ? undefined
        : patchProvenance.sourceRunId ?? currentProvenance.sourceRunId,
      ingestedBy: patchProvenance.ingestedBy === null
        ? undefined
        : patchProvenance.ingestedBy ?? currentProvenance.ingestedBy,
    })
    : currentProvenance;
  const currentStorage = input.record.storage;
  const nextStorage = input.patch.storagePatch === null
    ? undefined
    : input.patch.storagePatch
      ? normalizeStorage({
        reference: input.patch.storagePatch.reference === null
          ? ""
          : input.patch.storagePatch.reference ?? currentStorage?.reference ?? "",
        provider: input.patch.storagePatch.provider === null
          ? undefined
          : input.patch.storagePatch.provider ?? currentStorage?.provider,
      })
      : currentStorage;

  const imagePatch = input.patch.imagePatch;
  const nextImageMetadata = imagePatch
    ? applyMetadataPatch(input.record.image.metadata, imagePatch.metadataPatch)
    : input.record.image.metadata;
  const nextImage = createImageRecord({
    assetRef: imagePatch?.assetRef ?? input.record.image.assetRef,
    width: imagePatch?.width ?? input.record.image.width,
    height: imagePatch?.height ?? input.record.image.height,
    format: imagePatch?.format ?? input.record.image.format,
    mimeType: imagePatch?.mimeType === null
      ? undefined
      : imagePatch?.mimeType ?? input.record.image.mimeType,
    metadata: nextImageMetadata,
    tags: imagePatch?.tags ?? input.record.image.tags,
    derived: imagePatch?.derived === null
      ? undefined
      : imagePatch?.derived ?? input.record.image.derived,
    annotations: imagePatch?.annotations === null
      ? undefined
      : imagePatch?.annotations ?? input.record.image.annotations,
    schemaVersion: imagePatch?.schemaVersion === null
      ? undefined
      : imagePatch?.schemaVersion ?? input.record.image.schemaVersion,
  });

  return createDatasetInstanceImageRecord({
    recordId: input.record.recordId,
    instanceId: input.record.instanceId,
    systemId: input.record.systemId,
    datasetAssetId: input.record.datasetAssetId,
    datasetAssetVersionId: input.record.datasetAssetVersionId,
    image: nextImage,
    storage: nextStorage,
    metadata: nextMetadata,
    provenance: nextProvenance,
    admittedAt: input.record.admittedAt,
    updatedAt: nextUpdatedAt,
    mutationVersion: input.record.mutationVersion + 1,
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
