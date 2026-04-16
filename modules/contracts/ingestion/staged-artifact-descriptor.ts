import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
  type StorageObjectChecksum,
} from "../storage";
import {
  normalizeIngestionSourceKind,
  type IngestionSourceKind,
} from "./ingestion-source-kind";
import {
  type StagedDataDescriptor,
  type StagedDataMetadata,
} from "./staged-data-descriptor";

/**
 * Artifact-oriented companion contract for staged intake semantics.
 *
 * `StagedDataDescriptor` remains the compatibility surface for existing callers,
 * while this descriptor provides clearer ELT vocabulary without renaming the
 * existing public type.
 */
export interface StagedArtifactDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  id?: string;
  sourceKind: IngestionSourceKind;
  artifactKey: StorageArtifactKey;
  originalName?: string;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
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

export function normalizeStagedArtifactDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StagedArtifactDescriptor<TMetadata>,
): StagedArtifactDescriptor<TMetadata> {
  return {
    ...descriptor,
    id: normalizeOptionalText(descriptor.id),
    sourceKind: normalizeIngestionSourceKind(descriptor.sourceKind),
    artifactKey: normalizeStorageArtifactKey(descriptor.artifactKey),
    originalName: normalizeOptionalText(descriptor.originalName),
    mediaType: normalizeOptionalText(descriptor.mediaType),
    createdAt: normalizeOptionalText(descriptor.createdAt),
  };
}

export function createStagedArtifactDescriptorFromStagedDataDescriptor<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StagedDataDescriptor<TMetadata>,
): StagedArtifactDescriptor<TMetadata> {
  return normalizeStagedArtifactDescriptor({
    id: descriptor.id,
    sourceKind: descriptor.sourceKind,
    artifactKey: descriptor.storage.key,
    originalName: descriptor.originalName,
    mediaType: descriptor.storage.mediaType,
    sizeBytes: descriptor.storage.sizeBytes,
    checksum: descriptor.storage.checksum,
    createdAt: descriptor.createdAt,
    metadata: descriptor.metadata,
  });
}
