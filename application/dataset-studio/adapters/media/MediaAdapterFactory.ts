import type {
  IImageDimensionReader,
  IImageExifReader,
  IImageFormatDetector,
  IImageMetadataExtractor,
} from "../../../../domain/dataset-studio/interfaces/ImageMetadataExtraction";
import type { IImageTransformer } from "../../../../domain/dataset-studio/interfaces/ImageInspection";
import { ImageSizeDimensionReaderAdapter } from "./ImageDimensionReaderAdapter";
import { FileTypeImageFormatDetectorAdapter } from "./ImageFormatDetectorAdapter";
import {
  ExifrImageExifReaderAdapter,
  ImageMetadataExtractorAdapter,
} from "./ImageMetadataExtractorAdapter";
import { SharpImageTransformerAdapter } from "./SharpImageTransformerAdapter";

export interface MediaAdapterBundle {
  readonly formatDetector: IImageFormatDetector;
  readonly dimensionReader: IImageDimensionReader;
  readonly exifReader: IImageExifReader;
  readonly metadataExtractor: IImageMetadataExtractor;
  readonly imageTransformer: IImageTransformer;
}

export function createDefaultMediaAdapterBundle(): MediaAdapterBundle {
  const formatDetector = new FileTypeImageFormatDetectorAdapter();
  const dimensionReader = new ImageSizeDimensionReaderAdapter();
  const exifReader = new ExifrImageExifReaderAdapter();
  const metadataExtractor = new ImageMetadataExtractorAdapter({
    formatDetector,
    dimensionReader,
    exifReader,
  });
  const imageTransformer = new SharpImageTransformerAdapter();
  return Object.freeze({
    formatDetector,
    dimensionReader,
    exifReader,
    metadataExtractor,
    imageTransformer,
  });
}
