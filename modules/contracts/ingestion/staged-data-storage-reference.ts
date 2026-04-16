import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
  type StorageObjectChecksum,
} from "../storage";

export interface StagedDataStorageReference {
  key: StorageArtifactKey;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
}

export interface StagedDataStorageReferenceInput {
  key?: string;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
}

export function normalizeStagedDataStorageReference(
  reference: StagedDataStorageReference,
): StagedDataStorageReference {
  return {
    ...reference,
    key: normalizeStorageArtifactKey(reference.key),
  };
}
