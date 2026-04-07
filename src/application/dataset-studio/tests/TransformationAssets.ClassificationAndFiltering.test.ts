import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  DataClassificationAsset,
  FilteringAsset,
} from "../core/data/transformation";

function createClassificationInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "r1",
          fields: Object.freeze({
            email: "alice@example.com",
            phone: "+1 (617) 555-1000",
            full_name: "Alice Adams",
            status: "active",
            created_at: "2026-03-30",
            notes: "Customer requested weekly summary updates for billing trends.",
          }),
        },
        {
          recordId: "r2",
          fields: Object.freeze({
            email: "bob@example.com",
            phone: "+1 (617) 555-2000",
            full_name: "Bob Brown",
            status: "inactive",
            created_at: "2026-03-29",
            notes: "Escalated support request with multiple context details.",
          }),
        },
        {
          recordId: "r3",
          fields: Object.freeze({
            email: "carol@example.com",
            phone: "+1 (617) 555-3000",
            full_name: "Carol Clark",
            status: "active",
            created_at: "2026-03-28",
            notes: "Prefers email communication and weekend contact windows.",
          }),
        },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

function createFilteringInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "1", fields: Object.freeze({ status: "active", score: 90, city: "Boston", notes: "priority customer" }) },
        { recordId: "2", fields: Object.freeze({ status: "inactive", score: 72, city: "Chicago", notes: "monitor" }) },
        { recordId: "3", fields: Object.freeze({ status: "active", score: 55, city: "Boston", notes: "" }) },
        { recordId: "4", fields: Object.freeze({ status: "active", score: null, city: "Austin", notes: "new" }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("DataClassificationAsset", () => {
  it("classifies semantic and PII tags from field names and sampled values", async () => {
    const asset = new DataClassificationAsset();
    const output = await asset.execute(createClassificationInput(), {
      sampleSize: 500,
      emitFieldLevelTags: true,
      emitRecordLevelTags: true,
      useFieldNames: true,
      previewSampleSize: 2,
    });

    const emailField = output.classification.fields.find((field) => field.fieldName === "email");
    const statusField = output.classification.fields.find((field) => field.fieldName === "status");
    const notesField = output.classification.fields.find((field) => field.fieldName === "notes");
    expect(emailField?.tags).toContain("pii.email");
    expect(emailField?.tags).toContain("sensitivity.high");
    expect(statusField?.tags).toContain("semantic.category");
    expect(notesField?.tags).toContain("semantic.free_text");
    expect(output.recordFlags?.flaggedRows).toBeGreaterThan(0);
    expect(output.preview.fieldSummaries.length).toBe(2);
    expect(output.sampleRows.length).toBe(2);
  });

  it("supports include/exclude fields and classifier toggles", async () => {
    const asset = new DataClassificationAsset();
    const output = await asset.execute(createClassificationInput(), {
      includeFields: Object.freeze(["status", "created_at"]),
      excludeFields: Object.freeze(["created_at"]),
      enabledClassifiers: Object.freeze(["semantic"]),
      emitRecordLevelTags: false,
      confidenceThreshold: 0,
    });

    expect(output.classification.fields).toHaveLength(1);
    expect(output.classification.fields[0]?.fieldName).toBe("status");
    expect(output.classification.fields[0]?.tags.every((tag) => tag.startsWith("semantic.") || tag.startsWith("content."))).toBeTrue();
  });

  it("validates config and handles empty inputs", async () => {
    const asset = new DataClassificationAsset();
    await expect(asset.execute(createClassificationInput(), {
      maxSampleValuesPerField: 0,
    })).rejects.toThrow();

    const emptyOutput = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {});
    expect(emptyOutput.classification.totalRows).toBe(0);
    expect(emptyOutput.classification.fields).toHaveLength(0);
  });
});

describe("FilteringAsset", () => {
  it("filters rows with AND groups and comparison predicates", async () => {
    const asset = new FilteringAsset();
    const output = await asset.execute(createFilteringInput(), {
      mode: "include",
      logicalOperator: "and",
      conditions: Object.freeze([
        Object.freeze({ id: "active-status", fieldName: "status", operator: "equals", value: "active" }),
        Object.freeze({ id: "high-score", fieldName: "score", operator: "greater-than-or-equal", value: 80 }),
      ]),
      previewSampleSize: 5,
    });

    expect(output.filtering.includedRows).toBe(1);
    expect(output.filtering.excludedRows).toBe(3);
    expect(output.filtering.groupMatchedRows).toBe(1);
    expect(output.filtering.conditions.find((condition) => condition.conditionId === "active-status")?.matchCount).toBe(3);
    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      expect(output.data.records[0]?.recordId).toBe("1");
    }
  });

  it("supports OR mode, contains/prefix/suffix, null/empty and exclude behavior", async () => {
    const asset = new FilteringAsset();
    const output = await asset.execute(createFilteringInput(), {
      mode: "exclude",
      logicalOperator: "or",
      conditions: Object.freeze([
        Object.freeze({ fieldName: "city", operator: "starts-with", value: "Bos" }),
        Object.freeze({ fieldName: "notes", operator: "is-empty" }),
        Object.freeze({ fieldName: "score", operator: "is-null" }),
      ]),
      previewSampleSize: 10,
    });

    expect(output.filtering.totalRows).toBe(4);
    expect(output.filtering.groupMatchedRows).toBe(3);
    expect(output.filtering.includedRows).toBe(1);
    if (output.data.kind === "records") {
      expect(output.data.records.map((record) => record.recordId)).toEqual(["2"]);
    }
  });

  it("supports in/not-in and table input while preserving compatibility", async () => {
    const asset = new FilteringAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "region", label: "region", valueType: "string" },
          { columnId: "segment", label: "segment", valueType: "string" },
          { columnId: "value", label: "value", valueType: "number" },
        ]),
        rows: Object.freeze([
          { rowId: "row-1", cells: Object.freeze({ region: "east", segment: "a", value: 1 }) },
          { rowId: "row-2", cells: Object.freeze({ region: "west", segment: "b", value: 2 }) },
          { rowId: "row-3", cells: Object.freeze({ region: "north", segment: "a", value: 3 }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const output = await asset.execute(tableInput, {
      mode: "include",
      logicalOperator: "and",
      conditions: Object.freeze([
        Object.freeze({ fieldName: "segment", operator: "in", values: Object.freeze(["a"]) }),
        Object.freeze({ fieldName: "region", operator: "not-in", values: Object.freeze(["north"]) }),
      ]),
    });

    expect(output.data.kind).toBe("table");
    if (output.data.kind === "table") {
      expect(output.data.rows.map((row) => row.rowId)).toEqual(["row-1"]);
    }
  });

  it("validates config and handles sparse empty datasets", async () => {
    const asset = new FilteringAsset();
    await expect(asset.execute(createFilteringInput(), {
      conditions: Object.freeze([
        Object.freeze({ fieldName: "status", operator: "in", values: Object.freeze([]) }),
      ]),
    })).rejects.toThrow();

    const output = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {});
    expect(output.filtering.totalRows).toBe(0);
    expect(output.filtering.includedRows).toBe(0);
  });

  it("keeps all rows when exclude mode has no conditions", async () => {
    const asset = new FilteringAsset();
    const output = await asset.execute(createFilteringInput(), {
      mode: "exclude",
      conditions: Object.freeze([]),
    });
    expect(output.filtering.totalRows).toBe(4);
    expect(output.filtering.includedRows).toBe(4);
    expect(output.filtering.excludedRows).toBe(0);
    expect(output.filtering.groupMatchedRows).toBe(0);
  });
});

