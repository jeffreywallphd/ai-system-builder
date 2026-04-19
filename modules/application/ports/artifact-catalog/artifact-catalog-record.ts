import type { StorageObjectChecksum } from "../../../contracts/storage";

export interface ArtifactCatalogRecord {
  storageKey: string;
  /**
   * Optional coarse classification (for example: "image", "application", "text").
   * This is not the browser's primary inclusion rule; browse defaults must remain unfiltered.
   */
  artifactKind: string;
  mediaType?: string;
  sizeBytes?: number;
  sourceKind?: "upload";
  originalName?: string;
  createdAt?: string;
  checksum?: StorageObjectChecksum;
}
