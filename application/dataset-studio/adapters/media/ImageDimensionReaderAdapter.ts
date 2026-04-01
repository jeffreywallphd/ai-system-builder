import type {
  IImageDimensionReader,
  ImageDimensions,
} from "../../../../domain/dataset-studio/interfaces/ImageMetadataExtraction";

type ImageSizeFunction = (input: Uint8Array) => {
  readonly width?: number;
  readonly height?: number;
  readonly orientation?: number;
};

function assertPositiveDimension(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

export class ImageSizeDimensionReaderAdapter implements IImageDimensionReader {
  public async readDimensions(payload: Uint8Array): Promise<ImageDimensions> {
    let imageSizeFn: ImageSizeFunction | undefined;
    try {
      const imageSizeRecord = await import("image-size") as Readonly<Record<string, unknown>>;
      imageSizeFn = (imageSizeRecord.imageSize ?? imageSizeRecord.default) as ImageSizeFunction | undefined;
    } catch (error) {
      throw new Error(`Unable to load 'image-size': ${error instanceof Error ? error.message : String(error)}`);
    }

    if (typeof imageSizeFn !== "function") {
      throw new Error("'image-size' API is unavailable.");
    }

    const details = imageSizeFn(payload);
    return Object.freeze({
      width: assertPositiveDimension(details.width, "Image width"),
      height: assertPositiveDimension(details.height, "Image height"),
    });
  }
}
