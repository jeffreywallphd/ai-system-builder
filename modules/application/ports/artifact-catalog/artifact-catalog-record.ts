import type { StorageObjectChecksum } from "../../../contracts/storage";

export interface ArtifactCatalogRecord {
  storageKey: string;
  artifactKind: "image" | "data";
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: "upload";
  originalName?: string;
  createdAt?: string;
  checksum?: StorageObjectChecksum;
}
