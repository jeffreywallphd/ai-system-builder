import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  DataValidationAsset,
  DataValidationInvalidRowStrategies,
  DeduplicationAsset,
  DeduplicationKeepStrategies,
  DeduplicationModes,
} from "../core/data/transformation";

function createDedupInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "r1", fields: Object.freeze({ name: "Alice", email: "alice@example.com", score: 2, city: "New York", optional: null }) },
        { recordId: "r2", fields: Object.freeze({ name: "Alice", email: "alice@example.com", score: 2, city: "New York", optional: null }) },
        { recordId: "r3", fields: Object.freeze({ name: "Bob", email: "bob@example.com", score: 9, city: "Boston" }) },
        { recordId: "r4", fields: Object.freeze({ name: "Alicia", email: "alice@example.com", score: 8, city: "new  york", optional: null }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

function createValidationInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "v1", fields: Object.freeze({ id: "A1", age: 25, status: "active", code: "US-123", notes: "ok" }) },
        { recordId: "v2", fields: Object.freeze({ id: "", age: 200, status: "pending", code: "xx", notes: "x" }) },
        { recordId: "v3", fields: Object.freeze({ age: 40, status: "inactive", code: "US-456", notes: "valid length" }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("DeduplicationAsset", () => {
  it("supports exact duplicate matching across all fields", async () => {
    const asset = new DeduplicationAsset();
    const output = await asset.execute(createDedupInput(), {
      mode: DeduplicationModes.exactAll,
      keepStrategy: DeduplicationKeepStrategies.first,
      previewSampleSize: 5,
    });

    expect(output.deduplication.mode).toBe("exact-all");
    expect(output.deduplication.duplicateGroupCount).toBe(1);
    expect(output.deduplication.removedRows).toBe(1);
    expect(output.preview.groups[0]?.retainedRowId).toBe("r1");
  });

  it("supports exact duplicate matching on selected fields and keep-last", async () => {
    const asset = new DeduplicationAsset();
    const output = await asset.execute(createDedupInput(), {
      mode: DeduplicationModes.exactFields,
      targetFields: Object.freeze(["email"]),
      keepStrategy: DeduplicationKeepStrategies.last,
      previewSampleSize: 10,
    });

    expect(output.deduplication.duplicateGroupCount).toBe(1);
    expect(output.deduplication.removedRows).toBe(2);
    expect(output.preview.groups[0]?.retainedRowId).toBe("r4");
  });

  it("supports fuzzy duplicate matching with distance metadata", async () => {
    const asset = new DeduplicationAsset();
    const output = await asset.execute(createDedupInput(), {
      mode: DeduplicationModes.fuzzyFields,
      targetFields: Object.freeze(["city"]),
      maxDistance: 2,
      trimStrings: true,
      caseSensitive: false,
      keepStrategy: DeduplicationKeepStrategies.first,
    });

    expect(output.deduplication.duplicateGroupCount).toBeGreaterThan(0);
    expect(output.deduplication.duplicateGroups[0]?.pairDistances.length).toBeGreaterThan(0);
    expect(output.deduplication.duplicateGroups[0]?.confidence).toBeDefined();
  });

  it("supports keep-best with deterministic priority rules", async () => {
    const asset = new DeduplicationAsset();
    const output = await asset.execute(createDedupInput(), {
      mode: DeduplicationModes.exactFields,
      targetFields: Object.freeze(["email"]),
      keepStrategy: DeduplicationKeepStrategies.best,
      priorityRules: Object.freeze([
        Object.freeze({ fieldName: "score", direction: "descending" }),
      ]),
    });

    expect(output.preview.groups[0]?.retainedRowId).toBe("r4");
  });

  it("validates dedup config constraints", async () => {
    const asset = new DeduplicationAsset();
    await expect(asset.execute(createDedupInput(), {
      mode: DeduplicationModes.exactFields,
      targetFields: Object.freeze([]),
    })).rejects.toThrow();

    await expect(asset.execute(createDedupInput(), {
      keepStrategy: DeduplicationKeepStrategies.best,
      priorityRules: Object.freeze([]),
    })).rejects.toThrow();
  });

  it("handles table inputs and sparse empty inputs deterministically", async () => {
    const asset = new DeduplicationAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "email", label: "email", valueType: "string" },
          { columnId: "name", label: "name", valueType: "string" },
        ]),
        rows: Object.freeze([
          { rowId: "1", cells: Object.freeze({ email: "a@x.com", name: "A" }) },
          { rowId: "2", cells: Object.freeze({ email: "a@x.com", name: "A" }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });
    const tableOutput = await asset.execute(tableInput, { mode: DeduplicationModes.exactAll });
    expect(tableOutput.data.kind).toBe("table");
    if (tableOutput.data.kind === "table") {
      expect(tableOutput.data.rows.length).toBe(1);
    }

    const emptyOutput = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({ records: Object.freeze([]), metadata: { schemaVersion: "1.0.0" } }),
    }), {});
    expect(emptyOutput.deduplication.duplicateGroupCount).toBe(0);
  });
});

describe("DataValidationAsset", () => {
  it("validates required, type, enum, length, numeric, and pattern rules", async () => {
    const asset = new DataValidationAsset();
    const output = await asset.execute(createValidationInput(), {
      requiredFields: Object.freeze(["id"]),
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "age", expectedType: "number", min: 0, max: 120 }),
        Object.freeze({ fieldName: "status", allowedValues: Object.freeze(["active", "inactive"]) }),
        Object.freeze({ fieldName: "notes", minLength: 2, maxLength: 50 }),
        Object.freeze({ fieldName: "code", pattern: "^US-[0-9]{3}$" }),
      ]),
      invalidRowStrategy: DataValidationInvalidRowStrategies.annotateAndKeep,
      previewSampleSize: 5,
    });

    expect(output.validation.totalRows).toBe(3);
    expect(output.validation.invalidRows).toBe(2);
    expect(output.validation.issueCount).toBeGreaterThanOrEqual(4);
    expect(output.validation.issuesByField.some((entry) => entry.fieldName === "id")).toBeTrue();
    expect(output.preview.issueSamples.length).toBeGreaterThan(0);
    if (output.data.kind === "records") {
      expect(output.data.records[0]?.fields._validation).toBeDefined();
    }
  });

  it("supports drop-invalid strategy", async () => {
    const asset = new DataValidationAsset();
    const output = await asset.execute(createValidationInput(), {
      requiredFields: Object.freeze(["id"]),
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "age", max: 120 }),
      ]),
      invalidRowStrategy: DataValidationInvalidRowStrategies.dropInvalid,
    });

    expect(output.validation.invalidRows).toBe(2);
    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      expect(output.data.records.map((record) => record.recordId)).toEqual(["v1"]);
    }
  });

  it("supports split valid/invalid outputs", async () => {
    const asset = new DataValidationAsset();
    const output = await asset.execute(createValidationInput(), {
      requiredFields: Object.freeze(["id"]),
      invalidRowStrategy: DataValidationInvalidRowStrategies.splitValidInvalid,
    });

    expect(output.splitResults).toBeDefined();
    expect(output.splitResults?.validData.kind).toBe("records");
    expect(output.splitResults?.invalidData.kind).toBe("records");
    if (output.splitResults?.validData.kind === "records") {
      expect(output.splitResults.validData.records).toHaveLength(2);
    }
    if (output.splitResults?.invalidData.kind === "records") {
      expect(output.splitResults.invalidData.records).toHaveLength(1);
    }
  });

  it("validates config and handles sparse/empty table inputs", async () => {
    const asset = new DataValidationAsset();
    await expect(asset.execute(createValidationInput(), {
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "notes", minLength: 10, maxLength: 2 }),
      ]),
    })).rejects.toThrow();

    const tableOutput = await asset.execute(Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([{ columnId: "id", label: "id", valueType: "string" }]),
        rows: Object.freeze([{ rowId: "1", cells: Object.freeze({ id: "" }) }]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {
      requiredFields: Object.freeze(["id"]),
      invalidRowStrategy: DataValidationInvalidRowStrategies.dropInvalid,
    });
    expect(tableOutput.data.kind).toBe("table");
    if (tableOutput.data.kind === "table") {
      expect(tableOutput.data.rows).toHaveLength(0);
    }

    const emptyOutput = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {});
    expect(emptyOutput.validation.totalRows).toBe(0);
    expect(emptyOutput.validation.issueCount).toBe(0);
  });
});

