import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
  type StorageObjectChecksum,
  type StorageObjectDescriptor,
} from "../storage";
import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "./ingestion-source-kind";

export type StagedDataMetadata = Readonly<Record<string, unknown>>;

export interface StagedDataDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  id?: string;
  storageKey: StorageArtifactKey;
  sourceKind: IngestionSourceKind;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
  originalName?: string;
  createdAt?: string;
  metadata?: TMetadata;
}

export interface StagedDataDescriptorInput<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  id?: string;
  storageKey?: string;
  sourceKind?: IngestionSourceKind | string;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
  originalName?: string;
  createdAt?: string;
  metadata?: TMetadata;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeStagedDataDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StagedDataDescriptor<TMetadata>,
): StagedDataDescriptor<TMetadata> {
  return {
    ...descriptor,
    id: normalizeOptionalText(descriptor.id),
    storageKey: normalizeStorageArtifactKey(descriptor.storageKey),
    sourceKind: normalizeIngestionSourceKind(descriptor.sourceKind),
    originalName: normalizeOptionalText(descriptor.originalName),
    createdAt: normalizeOptionalText(descriptor.createdAt),
  };
}

export function normalizeStagedDataDescriptorInput<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor?: StagedDataDescriptorInput<TMetadata>,
): StagedDataDescriptorInput<TMetadata> {
  if (!descriptor) {
    return {};
  }

  return {
    ...descriptor,
    id: normalizeOptionalText(descriptor.id),
    storageKey:
      typeof descriptor.storageKey === "string"
        ? normalizeStorageArtifactKey(descriptor.storageKey)
        : undefined,
    sourceKind:
      typeof descriptor.sourceKind === "string"
        ? normalizeIngestionSourceKind(descriptor.sourceKind)
        : undefined,
    originalName: normalizeOptionalText(descriptor.originalName),
    createdAt: normalizeOptionalText(descriptor.createdAt),
  };
}

export function createStagedDataDescriptorFromStorageObjectDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StorageObjectDescriptor<TMetadata>,
  options: {
    sourceKind: IngestionSourceKind;
    originalName?: string;
    id?: string;
    createdAt?: string;
  },
): StagedDataDescriptor<TMetadata> {
  return normalizeStagedDataDescriptor({
    id: options.id,
    storageKey: descriptor.key,
    sourceKind: options.sourceKind,
    mediaType: descriptor.mediaType,
    sizeBytes: descriptor.sizeBytes,
    checksum: descriptor.checksum,
    originalName: options.originalName,
    createdAt: options.createdAt,
    metadata: descriptor.metadata,
  });
}
