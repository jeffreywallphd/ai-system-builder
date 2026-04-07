import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  DataProfilingAsset,
  FieldMappingAsset,
} from "../core/data/transformation";

function createRecordsInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "r1",
          fields: Object.freeze({
            name: "Alice",
            age: "42",
            score: 10,
            country: "US",
            notes: null,
          }),
        },
        {
          recordId: "r2",
          fields: Object.freeze({
            name: "Bob",
            age: null,
            score: 12.5,
            country: "US",
            notes: "prefers email",
          }),
        },
        {
          recordId: "r3",
          fields: Object.freeze({
            name: "Carol",
            age: "not-a-number",
            score: "",
            country: null,
            notes: "",
          }),
        },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("DataProfilingAsset", () => {
  it("profiles canonical records with per-field stats and dataset summary", async () => {
    const asset = new DataProfilingAsset();
    const output = await asset.execute(createRecordsInput(), {
      sampleSize: 100,
      computeNumericStats: true,
      computeDistinctCounts: true,
      maxSampleValuesPerField: 3,
      previewSampleSize: 2,
    });

    expect(output.profile.summary.rowCount).toBe(3);
    expect(output.profile.summary.profiledRowCount).toBe(3);
    expect(output.profile.summary.fieldCount).toBeGreaterThanOrEqual(5);
    expect(output.sampleRows.length).toBe(2);

    const score = output.profile.fields.find((field) => field.fieldName === "score");
    expect(score?.inferredTypeRef).toBe("number");
    expect(score?.numericStats?.mean).toBeDefined();
    expect(score?.minValue).toBeDefined();
    expect(score?.maxValue).toBeDefined();
  });

  it("supports preview sampling for mixed and sparse datasets", async () => {
    const asset = new DataProfilingAsset();
    const preview = await asset.preview(createRecordsInput(), {
      sampleSize: 2,
      previewSampleSize: 1,
      computeDistinctCounts: true,
      computeNumericStats: false,
      maxSampleValuesPerField: 2,
    });

    expect(preview.sample.kind).toBe("records");
    expect(preview.output.profile.summary.profiledRowCount).toBe(2);
    expect(preview.output.sampleRows.length).toBe(1);
  });

  it("validates config with zod defaults and bounds", async () => {
    const asset = new DataProfilingAsset();
    await expect(asset.execute(createRecordsInput(), {
      sampleSize: 0,
    })).rejects.toThrow();
  });

  it("handles empty datasets safely", async () => {
    const asset = new DataProfilingAsset();
    const emptyInput = Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });
    const output = await asset.execute(emptyInput, {});
    expect(output.profile.summary.rowCount).toBe(0);
    expect(output.profile.fields).toHaveLength(0);
  });
});

describe("FieldMappingAsset", () => {
  it("maps and renames fields while preserving unmapped fields by default", async () => {
    const asset = new FieldMappingAsset();
    const output = await asset.execute(createRecordsInput(), {
      mappings: Object.freeze([
        Object.freeze({ sourceField: "name", targetField: "fullName" }),
        Object.freeze({ sourceField: "age", targetField: "ageYears" }),
      ]),
      preserveUnmapped: true,
      dropEmptyTargets: false,
      previewSampleSize: 2,
    });

    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      const first = output.data.records[0]!;
      expect(first.fields.fullName).toBe("Alice");
      expect(first.fields.ageYears).toBe("42");
      expect(first.fields.score).toBe(10);
    }
    expect(output.mapping.sourceFieldNames).toContain("name");
    expect(output.mapping.targetFieldNames).toContain("fullName");
    expect(output.sampleRows.length).toBe(2);
  });

  it("drops unmapped fields and empty mapping targets when configured", async () => {
    const asset = new FieldMappingAsset();
    const output = await asset.execute(createRecordsInput(), {
      mappings: Object.freeze([
        Object.freeze({ sourceField: "score", targetField: "scoreValue" }),
      ]),
      preserveUnmapped: false,
      dropEmptyTargets: true,
      previewSampleSize: 10,
    });

    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      expect(Object.keys(output.data.records[0]!.fields)).toEqual(["scoreValue"]);
      expect(output.data.records[2]!.fields.scoreValue).toBeUndefined();
    }
  });

  it("supports table inputs and deterministic before/after preview metadata", async () => {
    const asset = new FieldMappingAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "first_name", label: "first_name", valueType: "string" },
          { columnId: "age", label: "age", valueType: "number" },
          { columnId: "city", label: "city", valueType: "string" },
        ]),
        rows: Object.freeze([
          { rowId: "1", cells: Object.freeze({ first_name: "Alice", age: 42, city: "NYC" }) },
          { rowId: "2", cells: Object.freeze({ first_name: "Bob", age: 38, city: "Boston" }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const preview = await asset.preview(tableInput, {
      mappings: Object.freeze([
        Object.freeze({ sourceField: "first_name", targetField: "name" }),
      ]),
      preserveUnmapped: true,
      dropEmptyTargets: false,
      previewSampleSize: 1,
    });

    expect(preview.output.data.kind).toBe("table");
    expect(preview.output.mapping.sourceFieldNames).toContain("first_name");
    expect(preview.output.mapping.targetFieldNames).toContain("name");
    expect(preview.output.sampleRows[0]?.name).toBe("Alice");
  });

  it("validates one-to-one mapping config", async () => {
    const asset = new FieldMappingAsset();
    await expect(asset.execute(createRecordsInput(), {
      mappings: Object.freeze([
        Object.freeze({ sourceField: "name", targetField: "display" }),
        Object.freeze({ sourceField: "name", targetField: "label" }),
      ]),
    })).rejects.toThrow();
  });
});

