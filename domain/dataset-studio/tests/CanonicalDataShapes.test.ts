import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
  isCanonicalDataShape,
  isCanonicalRecordValue,
  normalizeCanonicalDataMetadata,
} from "../CanonicalDataShapes";

describe("CanonicalDataShapes", () => {
  it("normalizes metadata and preserves lineage references", () => {
    const metadata = normalizeCanonicalDataMetadata({
      source: { fileName: " users.csv ", contentType: "Text/Csv " },
      lineage: [{ assetId: " asset-1 ", versionId: " version-1 ", relationship: "source" }],
    });

    expect(metadata.schemaVersion).toBe("1.0.0");
    expect(metadata.source?.fileName).toBe("users.csv");
    expect(metadata.source?.contentType).toBe("text/csv");
    expect(metadata.lineage?.[0]?.assetId).toBe("asset-1");
  });

  it("creates canonical records and table shapes with validation", () => {
    const records = createCanonicalRecordsShape({
      records: [
        { recordId: "record-1", fields: { name: "Ada", active: true, age: 37 } },
        { recordId: "record-2", fields: { name: "Lin", active: false, age: 41 } },
      ],
    });

    const table = createCanonicalTableShape({
      columns: [
        { columnId: "name", label: "Name", valueType: "string" },
        { columnId: "age", label: "Age", valueType: "number" },
      ],
      rows: records.records.map((record, index) => ({
        rowId: `row-${index + 1}`,
        cells: { name: record.fields.name, age: record.fields.age },
        sourceRecordId: record.recordId,
      })),
    });

    expect(records.kind).toBe("records");
    expect(table.kind).toBe("table");
    expect(isCanonicalDataShape(records)).toBe(true);
    expect(isCanonicalDataShape(table)).toBe(true);
  });

  it("creates text-item shapes with deterministic offsets", () => {
    const shape = createCanonicalTextItemsShape({
      items: [
        { itemId: "text-item-1", text: "Hello world", startOffset: 0, endOffset: 11 },
      ],
    });

    expect(shape.items).toHaveLength(1);
    expect(shape.items[0].startOffset).toBe(0);
    expect(shape.items[0].endOffset).toBe(11);
  });

  it("rejects table rows that reference unknown columns", () => {
    expect(() => createCanonicalTableShape({
      columns: [{ columnId: "known", label: "Known", valueType: "string" }],
      rows: [{ rowId: "row-1", cells: { unknown: "bad" } }],
    })).toThrow("unknown column");
  });

  it("guards canonical record value shape recursively", () => {
    expect(isCanonicalRecordValue({ nested: ["value", 1, true, null] })).toBe(true);
    expect(isCanonicalRecordValue({ bad: Symbol("x") })).toBe(false);
  });
});
