import type { StorageObjectChecksum } from "../../../contracts/storage";

export interface ArtifactCatalogRecord {
  storageKey: string;
  artifactKind: string;
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: "upload";
  originalName?: string;
  createdAt?: string;
  checksum?: StorageObjectChecksum;
}
