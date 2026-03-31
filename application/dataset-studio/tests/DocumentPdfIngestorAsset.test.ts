import { describe, expect, it } from "bun:test";
import { DataSourceReferenceKinds } from "../DataConverterContracts";
import {
  DocumentPdfIngestorAsset,
  DocumentPdfIngestorErrorCodes,
  type IDocumentPdfParser,
  type IDocumentPdfOcrStrategy,
} from "../DocumentPdfIngestorAsset";

class StubPdfParser implements IDocumentPdfParser {
  constructor(
    private readonly result: {
      readonly totalPages: number;
      readonly pages: ReadonlyArray<{ readonly pageNumber: number; readonly text: string }>;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
  ) {}

  public async parse(): Promise<{
    readonly totalPages: number;
    readonly pages: ReadonlyArray<{ readonly pageNumber: number; readonly text: string }>;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> {
    return this.result;
  }
}

describe("DocumentPdfIngestorAsset", () => {
  it("ingests PDF pages into canonical text items with page boundaries", async () => {
    const ingestor = new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser({
        totalPages: 2,
        pages: Object.freeze([
          Object.freeze({ pageNumber: 1, text: "First page text." }),
          Object.freeze({ pageNumber: 2, text: "Second page text." }),
        ]),
        metadata: Object.freeze({ title: "Sample PDF" }),
      }),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([1, 2, 3]),
        fileName: "sample.pdf",
        contentType: "application/pdf",
        diagnostics: Object.freeze([]),
      },
      config: {
        includePageText: true,
        previewPageCount: 1,
      },
      documentId: "doc-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful PDF ingestion.");
    }

    expect(result.output.kind).toBe("text-items");
    expect(result.output.items).toHaveLength(2);
    expect(result.output.items[0]?.metadata?.pageNumber).toBe(1);
    expect(result.preview.pageCount).toBe(2);
    expect(result.preview.pages).toHaveLength(1);
    expect(result.fullText.includes("Second page text.")).toBeTrue();
  });

  it("uses OCR strategy when parser yields no text", async () => {
    const ocr: IDocumentPdfOcrStrategy = {
      async extractTextFromPdf() {
        return Object.freeze({
          pages: Object.freeze([Object.freeze({ pageNumber: 1, text: "OCR text" })]),
          metadata: Object.freeze({ provider: "stub-ocr" }),
        });
      },
    };

    const ingestor = new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser({
        totalPages: 1,
        pages: Object.freeze([Object.freeze({ pageNumber: 1, text: "   " })]),
      }),
      ocrStrategy: ocr,
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([4, 5]),
        fileName: "scan.pdf",
        contentType: "application/pdf",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected OCR fallback to succeed.");
    }

    expect(result.output.items[0]?.text).toBe("OCR text");
  });

  it("ingests plain text sources", async () => {
    const ingestor = new DocumentPdfIngestorAsset({ pdfParser: new StubPdfParser({ totalPages: 0, pages: Object.freeze([]) }) });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: "alpha\n\nbeta",
        fileName: "notes.txt",
        contentType: "text/plain",
        diagnostics: Object.freeze([]),
      },
      documentId: "txt-1",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected text ingestion to succeed.");
    }
    expect(result.pageCount).toBe(1);
    expect(result.output.items[0]?.sourceDocumentId).toBe("txt-1");
  });

  it("returns structured failures for unsupported source types", async () => {
    const ingestor = new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser({ totalPages: 0, pages: Object.freeze([]) }),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([0]),
        fileName: "archive.zip",
        contentType: "application/zip",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected unsupported type failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(DocumentPdfIngestorErrorCodes.unsupportedType);
  });

  it("validates ingestion config with structured diagnostics", async () => {
    const ingestor = new DocumentPdfIngestorAsset({
      pdfParser: new StubPdfParser({ totalPages: 1, pages: Object.freeze([]) }),
    });

    const result = await ingestor.execute({
      source: {
        kind: "in-memory",
        reference: "in-memory",
        payload: new Uint8Array([1]),
        fileName: "sample.pdf",
        contentType: "application/pdf",
        diagnostics: Object.freeze([]),
      },
      config: {
        previewPageCount: 0,
      },
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      throw new Error("Expected config validation failure.");
    }
    expect(result.diagnostics[0]?.code).toBe(DocumentPdfIngestorErrorCodes.invalidConfig);
  });

  it("resolves source references through the data source locator seam", async () => {
    const ingestor = new DocumentPdfIngestorAsset({
      sourceLocator: {
        async resolve() {
          return Object.freeze({
            kind: "in-memory",
            reference: "resolved",
            payload: new Uint8Array([9, 9]),
            fileName: "resolved.pdf",
            contentType: "application/pdf",
            diagnostics: Object.freeze([]),
          });
        },
      },
      pdfParser: new StubPdfParser({
        totalPages: 1,
        pages: Object.freeze([Object.freeze({ pageNumber: 1, text: "resolved page" })]),
      }),
    });

    const result = await ingestor.resolveAndExecute({
      source: {
        kind: DataSourceReferenceKinds.localFile,
        path: "C:\\docs\\resolved.pdf",
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected resolved-source ingestion success.");
    }
    expect(result.pageCount).toBe(1);
  });
});
