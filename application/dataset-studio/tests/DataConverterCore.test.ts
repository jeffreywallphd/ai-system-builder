import { describe, expect, it } from "bun:test";
import { DataConverterCore, DataConverterError } from "../DataConverterCore";
import { DataConverterOperationKinds, DataSourceReferenceKinds } from "../DataConverterContracts";
import { DefaultDataSourceLocator, type IDataSourcePayloadLoader } from "../DataSourceLocator";

describe("DataConverterCore", () => {
  it("converts file-like json payloads into canonical records", () => {
    const converter = new DataConverterCore();

    const records = converter.convertFileLikeSourceToRecords({
      fileName: "users.json",
      contentType: "application/json",
      content: JSON.stringify([
        { id: "1", name: "Ada" },
        { id: "2", name: "Lin" },
      ]),
      sourceAssetId: "asset-users",
      sourceVersionId: "version-users-1",
    });

    expect(records.kind).toBe("records");
    expect(records.records).toHaveLength(2);
    expect(records.metadata.lineage?.[0]?.assetId).toBe("asset-users");
  });

  it("converts records into a canonical table", () => {
    const converter = new DataConverterCore();
    const records = converter.convertFileLikeSourceToRecords({
      formatHint: "csv",
      content: "name,score\nAda,10\nLin,8",
    });

    const table = converter.convertRecordsToTable({ records });
    expect(table.kind).toBe("table");
    expect(table.columns.map((column) => column.columnId)).toEqual(["name", "score"]);
    expect(table.rows[0].sourceRecordId).toBe("record-1");
  });

  it("ingests CSV with header auto-detection and configurable normalization", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: DataConverterOperationKinds.sourceToRecords,
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        reference: "in-memory",
        payload: " Name , Score \nAda,10\nLin,8",
        formatHint: "csv",
        diagnostics: Object.freeze([]),
      },
      header: "auto",
      normalizeHeadersToLowercase: true,
      skipEmptyLines: true,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful CSV ingestion.");
    }
    expect(result.output.kind).toBe("records");
    expect(result.output.records[0]?.fields.name).toBe("Ada");
    expect(result.output.records[0]?.fields.score).toBe("10");
  });

  it("ingests JSON with optional flattening", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: DataConverterOperationKinds.sourceToRecords,
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        reference: "in-memory",
        payload: JSON.stringify([{ user: { name: "Ada", profile: { level: 3 } } }]),
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
      flatten: true,
      maxDepth: 4,
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful JSON ingestion.");
    }
    expect(result.output.records[0]?.fields["user.name"]).toBe("Ada");
    expect(result.output.records[0]?.fields["user.profile.level"]).toBe(3);
  });

  it("converts documents into text items with line chunking", () => {
    const converter = new DataConverterCore();
    const textItems = converter.convertDocumentToTextItems({
      documentId: "doc-1",
      text: "first line\nsecond line",
      chunking: { mode: "line" },
      sourceAssetId: "asset-doc",
    });

    expect(textItems.kind).toBe("text-items");
    expect(textItems.items).toHaveLength(2);
    expect(textItems.items[0].sourceDocumentId).toBe("doc-1");
  });

  it("converts image metadata regions into structured records", () => {
    const converter = new DataConverterCore();
    const shape = converter.convertImageMetadataToRecords({
      imageId: "image-1",
      metadata: {
        regions: [
          { id: "region-1", label: "invoice-total", confidence: 0.99, x: 10, y: 20, width: 120, height: 45 },
          { id: "region-2", label: "invoice-date", confidence: 0.94, x: 140, y: 20, width: 100, height: 40 },
        ],
      },
      sourceAssetId: "asset-image",
    });

    expect(shape.kind).toBe("image-metadata-records");
    expect(shape.items).toHaveLength(2);
    expect(shape.items[0].boundingBox?.width).toBe(120);
  });

  it("returns a structured result envelope for converter operations", () => {
    const converter = new DataConverterCore();

    const result = converter.convert({
      operation: DataConverterOperationKinds.sourceToRecords,
      context: { requestId: "req-1", operationId: "op-1" },
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        reference: "in-memory",
        payload: JSON.stringify([{ name: "Ada" }]),
        formatHint: "json",
        diagnostics: Object.freeze([]),
      },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful conversion envelope.");
    }

    expect(result.contract.operation).toBe(DataConverterOperationKinds.sourceToRecords);
    expect(result.contract.inputBoundary).toBe("resolved-source");
    expect(result.context.requestId).toBe("req-1");
    expect(result.output.kind).toBe("records");
  });

  it("resolves local-file sources through the locator abstraction", async () => {
    class Loader implements IDataSourcePayloadLoader {
      async loadLocalFile(path: string): Promise<string> {
        return path.endsWith("customers.csv") ? "name,score\nAda,10" : "";
      }
      async loadUrl(): Promise<string> {
        throw new Error("unused");
      }
    }

    const converter = new DataConverterCore(new DefaultDataSourceLocator(new Loader()));
    const result = await converter.resolveAndConvertSourceToRecords({
      source: {
        kind: DataSourceReferenceKinds.localFile,
        path: "C:\\tmp\\customers.csv",
      },
      context: { requestId: "req-local" },
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected successful local-file conversion.");
    }

    expect(result.output.kind).toBe("records");
    expect(result.output.records).toHaveLength(1);
    expect(result.metadata.source?.fileName).toBe("customers.csv");
  });

  it("throws typed errors for invalid source payloads", () => {
    const converter = new DataConverterCore();
    try {
      converter.convertFileLikeSourceToRecords({ content: "" });
      throw new Error("expected conversion to fail");
    } catch (error) {
      expect(error instanceof DataConverterError).toBe(true);
      expect((error as DataConverterError).code).toBe("invalid_input");
    }
  });

  it("returns structured diagnostics for malformed CSV payloads", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: DataConverterOperationKinds.sourceToRecords,
      source: {
        kind: DataSourceReferenceKinds.inMemory,
        reference: "in-memory",
        payload: "name,score\n\"unterminated,10",
        formatHint: "csv",
        diagnostics: Object.freeze([]),
      },
      header: true,
    });

    expect(result.ok).toBeFalse();
    expect(result.diagnostics[0]?.code).toBe("parse_failed");
  });

  it("returns contract-level validation diagnostics for invalid requests", () => {
    const converter = new DataConverterCore();
    const result = converter.convert({
      operation: "document-to-text-items",
      text: " ",
    });

    expect(result.ok).toBeFalse();
    expect(result.diagnostics[0]?.code).toBe("document-text-missing");
    expect(result.diagnostics[0]?.details?.section).toBe("converter-request");
  });
});
