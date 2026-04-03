import type { CanonicalRecordValue } from "../CanonicalDataShapes";

export interface ImageFormatHint {
  readonly format?: string;
  readonly mimeType?: string;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ImageExifMetadata {
  readonly make?: string;
  readonly model?: string;
  readonly lensModel?: string;
  readonly dateTimeOriginal?: string;
  readonly orientation?: number;
  readonly gpsLatitude?: number;
  readonly gpsLongitude?: number;
}

export interface ImageMetadataExtractionResult {
  readonly dimensions: ImageDimensions;
  readonly formatHint?: ImageFormatHint;
  readonly orientation?: number;
  readonly exif?: ImageExifMetadata;
  readonly additionalMetadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface IImageFormatDetector {
  detect(payload: Uint8Array): Promise<ImageFormatHint | undefined>;
}

export interface IImageDimensionReader {
  readDimensions(payload: Uint8Array): Promise<ImageDimensions>;
}

export interface IImageExifReader {
  readExif(payload: Uint8Array): Promise<ImageExifMetadata | undefined>;
}

export interface IImageMetadataExtractor {
  extract(payload: Uint8Array): Promise<ImageMetadataExtractionResult>;
}
