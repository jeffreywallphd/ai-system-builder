import { describe, expect, it } from "bun:test";
import { DataConverterCore, DataConverterError } from "../DataConverterCore";

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
});
