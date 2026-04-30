export interface ImageBinaryRetrievalPort {
  getImageBinary(outputRef: unknown): Promise<Uint8Array>;
}
