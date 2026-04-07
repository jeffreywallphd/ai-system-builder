import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FileTypeImageFormatDetectorAdapter } from "../adapters/media/ImageFormatDetectorAdapter";
import { ImageSizeDimensionReaderAdapter } from "../adapters/media/ImageDimensionReaderAdapter";
import { ExifrImageExifReaderAdapter } from "../adapters/media/ImageMetadataExtractorAdapter";
import { ZodMediaRecordValidator } from "../adapters/validation/MediaDatasetValidator";

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

const projectRoot = process.cwd();

describe("Media Adapter Boundaries", () => {
  it("returns normalized results from format and dimension adapters", async () => {
    const formatDetector = new FileTypeImageFormatDetectorAdapter();
    const dimensions = new ImageSizeDimensionReaderAdapter();

    const formatHint = await formatDetector.detect(oneByOnePngBytes);
    const imageDimensions = await dimensions.readDimensions(oneByOnePngBytes);

    expect(formatHint?.format).toBe("png");
    expect(formatHint?.mimeType).toBe("image/png");
    expect(imageDimensions.width).toBe(1);
    expect(imageDimensions.height).toBe(1);
  });

  it("returns undefined EXIF metadata for payloads without EXIF", async () => {
    const exifReader = new ExifrImageExifReaderAdapter();
    const exif = await exifReader.readExif(oneByOnePngBytes);
    expect(exif).toBeUndefined();
  });

  it("returns normalized media validation diagnostics", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: { assetId: "asset:image:media-boundary" },
      width: 64,
      height: 32,
      format: "png",
    });

    expect(result.valid).toBeTrue();
    expect(result.diagnostics.errorCount).toBe(0);
    expect(result.value?.format).toBe("png");
  });

  it("keeps third-party media-library imports isolated to adapter boundaries", async () => {
    const protectedPaths = [
      "application/dataset-studio/ImageIngestorAsset.ts",
      "application/dataset-studio/MidLevelPipelineDefinitions.ts",
      "application/dataset-studio/DataStudioValidation.ts",
      "application/dataset-studio/UnifiedIngestionOrchestrationService.ts",
      "application/dataset-studio/adapters/schema-intents/MediaSchemaIntentAdapter.ts",
      "domain/dataset-studio/interfaces/ImageMetadataExtraction.ts",
      "domain/dataset-studio/interfaces/MediaValidation.ts",
      "domain/dataset-studio/contracts/ImageRecord.ts",
    ] as const;
    const forbiddenTokens = [
      "from \"sharp\"",
      "from 'sharp'",
      "import(\"sharp\")",
      "from \"exifr\"",
      "from 'exifr'",
      "import(\"exifr\")",
      "from \"image-size\"",
      "from 'image-size'",
      "import(\"image-size\")",
      "from \"file-type\"",
      "from 'file-type'",
      "import(\"file-type\")",
    ] as const;

    const violations: string[] = [];
    for (const relativePath of protectedPaths) {
      const absolutePath = path.resolve(projectRoot, relativePath);
      const content = await readFile(absolutePath, "utf-8");
      for (const token of forbiddenTokens) {
        if (content.includes(token)) {
          violations.push(`${relativePath}: ${token}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps zod usage out of image ingestion orchestration contracts", async () => {
    const imageIngestorPath = path.resolve(projectRoot, "application/dataset-studio/ImageIngestorAsset.ts");
    const content = await readFile(imageIngestorPath, "utf-8");
    expect(content.includes("from \"zod\"") || content.includes("from 'zod'")).toBeFalse();
  });
});
