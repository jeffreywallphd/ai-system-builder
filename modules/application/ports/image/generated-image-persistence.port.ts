import type { ImageGenerationOutput } from "../../../contracts/image-generation";

export interface PersistGeneratedImageInput {
  output: ImageGenerationOutput;
  requestId: string;
  preferredFileName?: string;
}

import type { StorageObjectChecksum } from "../../../contracts/storage";

export interface PersistGeneratedImageResult {
  artifactId: string;
  storageKey: string;
  mediaType: string;
  sizeBytes: number;
  checksum: StorageObjectChecksum;
  originalFileName: string;
}

export interface GeneratedImagePersistencePort {
  persistGeneratedImage(input: PersistGeneratedImageInput): Promise<PersistGeneratedImageResult>;
}
