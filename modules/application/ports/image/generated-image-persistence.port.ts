import type { ImageGenerationOutput } from "../../../contracts/image-generation";

export interface PersistGeneratedImageInput {
  output: ImageGenerationOutput;
  requestId: string;
}

export interface PersistGeneratedImageResult {
  artifactId: string;
  storageKey: string;
  mediaType: string;
  sizeBytes: number;
  checksum: string;
  originalFileName: string;
}

export interface GeneratedImagePersistencePort {
  persistGeneratedImage(input: PersistGeneratedImageInput): Promise<PersistGeneratedImageResult>;
}
