import { describe, expect, it } from "bun:test";
import { DataSourceReferenceKinds } from "../DataConverterContracts";
import {
  ImageIngestorAsset,
  ImageIngestorErrorCodes,
  type IImageExifReader,
  type IImageMetadataProbe,
} from "../ImageIngestorAsset";

class StubMetadataProbe implements IImageMetadataProbe {
  constructor(
    private readonly metadata: {
      readonly width: number;
      readonly height: number;
      readonly format: string;
      readonly orientation?: number;
    },
  ) {}

  public async probe(): Promise<{
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly orientation?: number;
  }> {
    return this.metadata;
  }
}

class StubExifReader implements IImageExifReader {
  constructor(private readonly result?: Readonly<Record<string, unknown>>) {}

  public async read(): Promise<Readonly<Record<string, unknown>> | undefined> {
    return this.result;
  }
}

describe("ImageIngestorAsset", () => {
  it("ingests image metadata into canonical image-metadata-records", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe({ width: 1200, height: 800, format: "jpeg", orientation: 1 }),
      exifReader: new StubExifReader({ Make: "Canon", Model: "EOS" }),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([1, 2, 3, 4]),
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        diagnostics: Object.freeze([]),
      },
      imageId: "photo-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful image ingestion.");
    }

    expect(result.output.kind).toBe("image-metadata-records");
    expect(result.output.items).toHaveLength(1);
    expect(result.preview.width).toBe(1200);
    expect(result.preview.exifHighlights?.Make).toBe("Canon");
    expect(result.preview.normalized.ingestor).toBe("image-ingestor-v1");
  });

  it("normalizes dimensions for rotated orientation when enabled", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe({ width: 600, height: 400, format: "jpeg", orientation: 6 }),
      exifReader: new StubExifReader(),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([8, 8]),
        fileName: "rotated.jpg",
        contentType: "image/jpeg",
        diagnostics: Object.freeze([]),
      },
      config: {
        normalizeOrientation: true,
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected normalized-orientation success.");
    }

    expect(result.preview.width).toBe(400);
    expect(result.preview.height).toBe(600);
  });

  it("returns structured failures for unsupported image types", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe({ width: 10, height: 10, format: "png" }),
      exifReader: new StubExifReader(),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([0]),
        fileName: "vector.svg",
        contentType: "image/svg+xml",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected unsupported type failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(ImageIngestorErrorCodes.unsupportedType);
  });

  it("returns extraction failures for unreadable/corrupt images", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: {
        async probe() {
          throw new Error("corrupt image");
        },
      },
      exifReader: new StubExifReader(),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([7, 7]),
        fileName: "broken.png",
        contentType: "image/png",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected metadata extraction failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(ImageIngestorErrorCodes.metadataExtractionFailed);
  });

  it("validates image ingestor config with structured diagnostics", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe({ width: 10, height: 10, format: "png" }),
      exifReader: new StubExifReader(),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([1, 2, 3]),
        fileName: "ok.png",
        contentType: "image/png",
        diagnostics: Object.freeze([]),
      },
      config: {
        // @ts-expect-error test invalid runtime config
        extractExif: "yes",
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected invalid config failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(ImageIngestorErrorCodes.invalidConfig);
  });

  it("resolves source references through the source locator seam", async () => {
    const ingestor = new ImageIngestorAsset({
      sourceLocator: {
        async resolve() {
          return Object.freeze({
            kind: "in-memory",
            reference: "resolved",
            payload: new Uint8Array([2, 2, 2]),
            fileName: "resolved.webp",
            contentType: "image/webp",
            diagnostics: Object.freeze([]),
          });
        },
      },
      metadataProbe: new StubMetadataProbe({ width: 320, height: 240, format: "webp" }),
      exifReader: new StubExifReader(),
    });

    const result = await ingestor.resolveAndExecute({
      source: {
        kind: DataSourceReferenceKinds.url,
        url: "https://example.com/a.webp",
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected resolved-source image ingestion success.");
    }
    expect(result.preview.format).toBe("webp");
  });
});
