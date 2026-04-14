export type StorageObjectMetadata = Readonly<Record<string, unknown>>;

export interface StorageObjectChecksum {
  algorithm: string;
  value: string;
}

export interface StorageObjectDescriptor<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  key: string;
  mediaType?: string;
  sizeBytes?: number;
  checksum?: StorageObjectChecksum;
  metadata?: TMetadata;
}

export interface StorageObjectDescriptorInput<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  key?: string;
  mediaType?: string;
  checksum?: StorageObjectChecksum;
  metadata?: TMetadata;
}
