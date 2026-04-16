import {
  type StorageObjectDescriptor,
} from "../storage";
import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "./ingestion-source-kind";
import {
  normalizeStagedDataStorageReference,
  type StagedDataStorageReference,
  type StagedDataStorageReferenceInput,
} from "./staged-data-storage-reference";

export type StagedDataMetadata = Readonly<Record<string, unknown>>;

export interface StagedDataDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  id?: string;
  sourceKind: IngestionSourceKind;
  originalName?: string;
  createdAt?: string;
  metadata?: TMetadata;
  storage: StagedDataStorageReference;
}

export interface StagedDataDescriptorInput<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  id?: string;
  sourceKind?: IngestionSourceKind | string;
  originalName?: string;
  createdAt?: string;
  metadata?: TMetadata;
  storage?: StagedDataStorageReferenceInput;
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
    sourceKind: normalizeIngestionSourceKind(descriptor.sourceKind),
    originalName: normalizeOptionalText(descriptor.originalName),
    createdAt: normalizeOptionalText(descriptor.createdAt),
    storage: normalizeStagedDataStorageReference(descriptor.storage),
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

  let normalizedStorage: StagedDataStorageReferenceInput | undefined;
  if (descriptor.storage) {
    normalizedStorage = {
      ...descriptor.storage,
      key:
        typeof descriptor.storage.key === "string"
          ? normalizeStagedDataStorageReference({
            key: descriptor.storage.key,
            mediaType: descriptor.storage.mediaType,
            sizeBytes: descriptor.storage.sizeBytes,
            checksum: descriptor.storage.checksum,
          }).key
          : undefined,
    };
  }

  return {
    ...descriptor,
    id: normalizeOptionalText(descriptor.id),
    sourceKind:
      typeof descriptor.sourceKind === "string"
        ? normalizeIngestionSourceKind(descriptor.sourceKind)
        : undefined,
    originalName: normalizeOptionalText(descriptor.originalName),
    createdAt: normalizeOptionalText(descriptor.createdAt),
    storage: normalizedStorage,
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
    sourceKind: options.sourceKind,
    originalName: options.originalName,
    createdAt: options.createdAt,
    metadata: descriptor.metadata,
    storage: {
      key: descriptor.key,
      mediaType: descriptor.mediaType,
      sizeBytes: descriptor.sizeBytes,
      checksum: descriptor.checksum,
    },
  });
}
