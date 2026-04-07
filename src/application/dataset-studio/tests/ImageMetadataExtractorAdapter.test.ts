import { describe, expect, it } from "bun:test";
import type {
  IImageDimensionReader,
  IImageExifReader,
  IImageFormatDetector,
} from "../../../domain/dataset-studio/interfaces/ImageMetadataExtraction";
import {
  ExifrImageExifReaderAdapter,
  ImageMetadataExtractorAdapter,
} from "../adapters/media/ImageMetadataExtractorAdapter";

const oneByOnePngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00,
  0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63,
  0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d,
  0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("ImageMetadataExtractorAdapter", () => {
  it("extracts image dimensions and format hints", async () => {
    const extractor = new ImageMetadataExtractorAdapter();
    const result = await extractor.extract(oneByOnePngBytes);

    expect(result.dimensions.width).toBe(1);
    expect(result.dimensions.height).toBe(1);
    expect(result.formatHint?.format).toBe("png");
  });

  it("degrades gracefully when EXIF metadata is missing", async () => {
    const extractor = new ImageMetadataExtractorAdapter();
    const result = await extractor.extract(oneByOnePngBytes);

    expect(result.exif).toBeUndefined();
  });

  it("maps EXIF metadata into normalized contract fields", async () => {
    const detector: IImageFormatDetector = Object.freeze({
      detect: async () => Object.freeze({
        format: "jpeg",
        mimeType: "image/jpeg",
      }),
    });
    const dimensions: IImageDimensionReader = Object.freeze({
      readDimensions: async () => Object.freeze({
        width: 640,
        height: 480,
      }),
    });
    const exif: IImageExifReader = Object.freeze({
      readExif: async () => Object.freeze({
        make: "Canon",
        model: "EOS",
        orientation: 6,
        gpsLatitude: 40.7128,
        gpsLongitude: -74.0060,
      }),
    });
    const extractor = new ImageMetadataExtractorAdapter({
      formatDetector: detector,
      dimensionReader: dimensions,
      exifReader: exif,
    });

    const result = await extractor.extract(new Uint8Array([1, 2, 3]));
    expect(result.exif?.make).toBe("Canon");
    expect(result.orientation).toBe(6);
    expect(result.additionalMetadata?.Make).toBe("Canon");
  });

  it("surfaces unsupported/partial metadata when dimensions are unreadable", async () => {
    const extractor = new ImageMetadataExtractorAdapter({
      dimensionReader: {
        async readDimensions() {
          throw new Error("Unsupported image dimensions");
        },
      },
    });

    await expect(extractor.extract(new Uint8Array([0]))).rejects.toThrow("Unsupported image dimensions");
  });
});

describe("ExifrImageExifReaderAdapter", () => {
  it("returns undefined when payload does not contain EXIF metadata", async () => {
    const adapter = new ExifrImageExifReaderAdapter();
    const result = await adapter.readExif(oneByOnePngBytes);
    expect(result).toBeUndefined();
  });
});
