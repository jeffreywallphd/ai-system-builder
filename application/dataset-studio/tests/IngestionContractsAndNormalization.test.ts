import { describe, expect, it } from "bun:test";
import {
  CsvIngestorAsset,
  CsvIngestorErrorCodes,
} from "../CsvIngestorAsset";
import { JsonIngestorAsset, JsonIngestorErrorCodes } from "../JsonIngestorAsset";
import {
  DocumentPdfIngestorAsset,
  type IDocumentPdfParser,
} from "../DocumentPdfIngestorAsset";
import {
  ImageIngestorAsset,
  type IImageExifReader,
  type IImageMetadataProbe,
} from "../ImageIngestorAsset";

class StubPdfParser implements IDocumentPdfParser {
  public async parse(): Promise<{
    readonly totalPages: number;
    readonly pages: ReadonlyArray<{ readonly pageNumber: number; readonly text: string }>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> {
    return Object.freeze({
      totalPages: 2,
      pages: Object.freeze([
        Object.freeze({ pageNumber: 1, text: "A page" }),
        Object.freeze({ pageNumber: 2, text: "B page" }),
      ]),
      metadata: Object.freeze({ title: "doc" }),
    });
  }
}

class StubMetadataProbe implements IImageMetadataProbe {
  public async probe(): Promise<{ readonly width: number; readonly height: number; readonly format: string; readonly orientation?: number }> {
    return Object.freeze({ width: 200, height: 100, format: "jpeg", orientation: 1 });
  }
}

class StubExifReader implements IImageExifReader {
  public async read(): Promise<Readonly<Record<string, unknown>> | undefined> {
    return Object.freeze({ Make: "Canon" });
  }
}

describe("Ingestion contracts + normalization", () => {
  it("normalizes CSV into canonical records output with source metadata", () => {
    const ingestor = new CsvIngestorAsset();
    const result = ingestor.execute({
      payload: "id,name\n1,Ada",
      config: { header: true },
      fileName: "users.csv",
      sourceReference: "C:\\tmp\\users.csv",
      sourceId: "src-1",
      sourceAssetId: "asset-1",
      sourceVersionId: "v1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected CSV success.");
    }
    expect(result.output.kind).toBe("records");
    expect(result.output.metadata.source?.fileName).toBe("users.csv");
    expect(result.output.metadata.attributes?.sourceReference).toBe("C:\\tmp\\users.csv");
    expect(result.normalized.preview.kind).toBe("records");
  });

  it("normalizes JSON into canonical records and applies default config", () => {
    const ingestor = new JsonIngestorAsset();
    const result = ingestor.execute({
      payload: "{\"id\":1,\"name\":\"Ada\"}",
      sourceReference: "in-memory://users.json",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected JSON success.");
    }
    expect(result.config.flatten).toBeFalse();
    expect(result.output.kind).toBe("records");
    expect(result.output.metadata.attributes?.sourceReference).toBe("in-memory://users.json");
  });

  it("rejects invalid CSV request contract with structured diagnostics", () => {
    const ingestor = new CsvIngestorAsset();
    const result = ingestor.execute({
      // @ts-expect-error runtime contract validation coverage
      payload: 42,
      config: { header: true },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected CSV contract failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(CsvIngestorErrorCodes.invalidConfig);
    expect(result.normalized.ok).toBeFalse();
    expect(result.normalized.issues[0]?.category).toBe("invalid-configuration");
  });

  it("rejects invalid JSON request contract with structured diagnostics", () => {
    const ingestor = new JsonIngestorAsset();
    const result = ingestor.execute({
      // @ts-expect-error runtime contract validation coverage
      payload: 42,
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected JSON contract failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(JsonIngestorErrorCodes.invalidConfig);
    expect(result.normalized.ok).toBeFalse();
    expect(result.normalized.issues[0]?.category).toBe("invalid-configuration");
  });

  it("preserves document source/extraction metadata in normalized output", async () => {
    const ingestor = new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser(),
    });
    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([1, 2, 3]),
        fileName: "doc.pdf",
        contentType: "application/pdf",
        sourceAssetId: "asset-doc",
        sourceVersionId: "v2",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected PDF success.");
    }
    expect(result.output.metadata.source?.fileName).toBe("doc.pdf");
    expect(result.output.metadata.lineage?.[0]?.assetId).toBe("asset-doc");
    expect(result.output.metadata.attributes?.sourceReference).toBe("in-memory");
    expect(result.normalized.preview.kind).toBe("text-items");
  });

  it("preserves image metadata and source lineage in normalized output", async () => {
    const ingestor = new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe(),
      exifReader: new StubExifReader(),
    });
    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "image-source",
        payload: new Uint8Array([1, 2, 3, 4]),
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        sourceAssetId: "asset-image",
        sourceVersionId: "v3",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected image success.");
    }
    expect(result.output.metadata.source?.fileName).toBe("photo.jpg");
    expect(result.output.metadata.lineage?.[0]?.assetId).toBe("asset-image");
    expect(result.output.metadata.attributes?.sourceReference).toBe("image-source");
    expect(result.normalized.preview.kind).toBe("image-metadata-records");
  });

  it("emits consistent normalized preview envelopes across ingestors", async () => {
    const csv = new CsvIngestorAsset().preview({
      payload: "id,name\n1,Ada\n2,Lin",
      config: { header: true },
    }, 1);
    if ("ok" in csv && !csv.ok) {
      throw new Error("Expected CSV preview success.");
    }

    const json = new JsonIngestorAsset().preview({
      payload: JSON.stringify([{ id: 1 }, { id: 2 }]),
    }, 1);
    if ("ok" in json && !json.ok) {
      throw new Error("Expected JSON preview success.");
    }

    const doc = await new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser(),
    }).preview({
      source: {
        kind: "in-memory",
        reference: "doc-preview",
        payload: new Uint8Array([5, 5]),
        fileName: "doc.pdf",
        contentType: "application/pdf",
        diagnostics: Object.freeze([]),
      },
    });
    if ("ok" in doc && !doc.ok) {
      throw new Error("Expected document preview success.");
    }

    const image = await new ImageIngestorAsset({
      metadataProbe: new StubMetadataProbe(),
      exifReader: new StubExifReader(),
    }).preview({
      source: {
        kind: "in-memory",
        reference: "img-preview",
        payload: new Uint8Array([7, 7]),
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        diagnostics: Object.freeze([]),
      },
    });
    if ("ok" in image && !image.ok) {
      throw new Error("Expected image preview success.");
    }

    expect(csv.normalized.contractVersion).toBe("1.0.0");
    expect(json.normalized.contractVersion).toBe("1.0.0");
    expect(doc.normalized.contractVersion).toBe("1.0.0");
    expect(image.normalized.contractVersion).toBe("1.0.0");
  });
});

