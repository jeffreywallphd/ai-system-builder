import {
  normalizeStorageArtifactKey,
  type StorageArtifactKey,
} from "./storage-artifact-key";
import {
  normalizeStorageInstanceReference,
  type StorageInstanceReference,
} from "./storage-instance-reference";

export interface StoragePlacementDescriptor {
  instance: StorageInstanceReference;
  key: StorageArtifactKey;
}

export function normalizeStoragePlacementDescriptor(
  descriptor: StoragePlacementDescriptor,
): StoragePlacementDescriptor {
  return {
    ...descriptor,
    instance: normalizeStorageInstanceReference(descriptor.instance),
    key: normalizeStorageArtifactKey(descriptor.key),
  };
}
