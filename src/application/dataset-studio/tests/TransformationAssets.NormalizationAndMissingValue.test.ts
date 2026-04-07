import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  MissingValueHandlingAsset,
  MissingValueStrategies,
  TypeNormalizationAsset,
  TypeNormalizationFailureStrategies,
  TypeNormalizationTargetTypes,
} from "../core/data/transformation";

function createNormalizationInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "r1",
          fields: Object.freeze({
            age: " 42 ",
            active: "YES",
            createdAt: "2026-03-30",
            display: 123,
            notes: "  hello  ",
            optional: "",
          }),
        },
        {
          recordId: "r2",
          fields: Object.freeze({
            age: "not-a-number",
            active: "unknown",
            createdAt: "03/30/2026",
            display: "alpha",
            notes: " ",
            optional: "",
          }),
        },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

function createMissingInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "r1",
          fields: Object.freeze({ country: "", city: "Boston", score: null, code: "A" }),
        },
        {
          recordId: "r2",
          fields: Object.freeze({ country: "US", city: "   ", score: 10, code: "" }),
        },
        {
          recordId: "r3",
          fields: Object.freeze({ country: null, city: "", score: null, code: "C" }),
        },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("TypeNormalizationAsset", () => {
  it("normalizes configured fields and reports conversion outcomes", async () => {
    const asset = new TypeNormalizationAsset();
    const output = await asset.execute(createNormalizationInput(), {
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "age", targetType: TypeNormalizationTargetTypes.number }),
        Object.freeze({ fieldName: "active", targetType: TypeNormalizationTargetTypes.boolean }),
        Object.freeze({ fieldName: "createdAt", targetType: TypeNormalizationTargetTypes.date }),
        Object.freeze({ fieldName: "display", targetType: TypeNormalizationTargetTypes.string }),
      ]),
      inferredFieldTypes: Object.freeze({ notes: TypeNormalizationTargetTypes.string }),
      trimStrings: true,
      emptyStringAsNull: true,
      onConversionFailure: TypeNormalizationFailureStrategies.preserve,
      previewSampleSize: 2,
    });

    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      expect(output.data.records[0]?.fields.age).toBe(42);
      expect(output.data.records[0]?.fields.active).toBeTrue();
      expect(output.data.records[0]?.fields.createdAt).toBe("2026-03-30T00:00:00.000Z");
      expect(output.data.records[0]?.fields.display).toBe("123");
      expect(output.data.records[0]?.fields.notes).toBe("hello");
      expect(output.data.records[0]?.fields.optional).toBeNull();
      expect(output.data.records[1]?.fields.age).toBe("not-a-number");
    }

    const age = output.normalization.fields.find((field) => field.fieldName === "age");
    const active = output.normalization.fields.find((field) => field.fieldName === "active");
    expect(age?.convertedCount).toBe(1);
    expect(age?.failedCount).toBe(1);
    expect(active?.failedCount).toBe(1);
    expect(output.preview.rowDeltas.length).toBe(2);
  });

  it("supports set-null conversion failure strategy and table inputs", async () => {
    const asset = new TypeNormalizationAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "flag", label: "flag", valueType: "string" },
          { columnId: "amount", label: "amount", valueType: "string" },
        ]),
        rows: Object.freeze([
          { rowId: "1", cells: Object.freeze({ flag: "true", amount: "10" }) },
          { rowId: "2", cells: Object.freeze({ flag: "unknown", amount: "oops" }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const output = await asset.execute(tableInput, {
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "flag", targetType: TypeNormalizationTargetTypes.boolean }),
        Object.freeze({ fieldName: "amount", targetType: TypeNormalizationTargetTypes.number }),
      ]),
      onConversionFailure: TypeNormalizationFailureStrategies.setNull,
      previewSampleSize: 2,
    });

    expect(output.data.kind).toBe("table");
    if (output.data.kind === "table") {
      expect(output.data.rows[1]?.cells.flag).toBeNull();
      expect(output.data.rows[1]?.cells.amount).toBeNull();
      expect(output.data.columns.find((column) => column.columnId === "amount")?.valueType).toBe("number");
    }
  });

  it("validates duplicate field rule config", async () => {
    const asset = new TypeNormalizationAsset();
    await expect(asset.execute(createNormalizationInput(), {
      fieldRules: Object.freeze([
        Object.freeze({ fieldName: "age", targetType: TypeNormalizationTargetTypes.number }),
        Object.freeze({ fieldName: "age", targetType: TypeNormalizationTargetTypes.string }),
      ]),
    })).rejects.toThrow();
  });
});

describe("MissingValueHandlingAsset", () => {
  it("fills missing values using default and per-field strategies", async () => {
    const asset = new MissingValueHandlingAsset();
    const output = await asset.execute(createMissingInput(), {
      targetFields: Object.freeze(["country", "city", "score", "code"]),
      strategy: MissingValueStrategies.fillDefault,
      defaultFillValue: "N/A",
      perFieldOverrides: Object.freeze([
        Object.freeze({ fieldName: "score", strategy: "fill-constant", fillValue: 0 }),
      ]),
      treatEmptyStringAsMissing: true,
      treatWhitespaceAsMissing: true,
      previewSampleSize: 2,
    });

    expect(output.data.kind).toBe("records");
    if (output.data.kind === "records") {
      expect(output.data.records[0]?.fields.country).toBe("N/A");
      expect(output.data.records[0]?.fields.score).toBe(0);
      expect(output.data.records[1]?.fields.city).toBe("N/A");
      expect(output.data.records[1]?.fields.code).toBe("N/A");
    }

    expect(output.missingValueHandling.valuesFilled).toBeGreaterThan(0);
    expect(output.missingValueHandling.rowsDropped).toBe(0);
    expect(output.preview.rowDeltas.length).toBe(2);
  });

  it("drops rows with missing values using any/all modes", async () => {
    const asset = new MissingValueHandlingAsset();
    const anyOutput = await asset.execute(createMissingInput(), {
      targetFields: Object.freeze(["country", "city"]),
      strategy: MissingValueStrategies.dropRow,
      rowDropMode: "any",
      treatEmptyStringAsMissing: true,
      treatWhitespaceAsMissing: true,
    });

    expect(anyOutput.data.kind).toBe("records");
    if (anyOutput.data.kind === "records") {
      expect(anyOutput.data.records.length).toBe(0);
    }
    expect(anyOutput.missingValueHandling.rowsDropped).toBe(3);

    const allOutput = await asset.execute(createMissingInput(), {
      targetFields: Object.freeze(["country", "city"]),
      strategy: MissingValueStrategies.dropRow,
      rowDropMode: "all",
      treatEmptyStringAsMissing: true,
      treatWhitespaceAsMissing: true,
    });

    expect(allOutput.data.kind).toBe("records");
    if (allOutput.data.kind === "records") {
      expect(allOutput.data.records.length).toBe(2);
    }
    expect(allOutput.missingValueHandling.rowsDropped).toBe(1);
  });

  it("handles sparse table and empty datasets deterministically", async () => {
    const asset = new MissingValueHandlingAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "region", label: "region", valueType: "string" },
          { columnId: "value", label: "value", valueType: "number" },
        ]),
        rows: Object.freeze([
          { rowId: "1", cells: Object.freeze({ region: "", value: null }) },
          { rowId: "2", cells: Object.freeze({ region: "east", value: 1 }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const tableOutput = await asset.execute(tableInput, {
      strategy: MissingValueStrategies.fillPerField,
      perFieldFillValues: Object.freeze({ region: "unknown", value: 0 }),
      treatEmptyStringAsMissing: true,
      treatWhitespaceAsMissing: true,
    });

    expect(tableOutput.data.kind).toBe("table");
    if (tableOutput.data.kind === "table") {
      expect(tableOutput.data.rows[0]?.cells.region).toBe("unknown");
      expect(tableOutput.data.rows[0]?.cells.value).toBe(0);
    }

    const emptyOutput = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {
      strategy: MissingValueStrategies.fillDefault,
      defaultFillValue: "x",
    });

    expect(emptyOutput.missingValueHandling.rowsChanged).toBe(0);
    expect(emptyOutput.missingValueHandling.rowsDropped).toBe(0);
  });

  it("validates duplicate target and override field config", async () => {
    const asset = new MissingValueHandlingAsset();
    await expect(asset.execute(createMissingInput(), {
      targetFields: Object.freeze(["country", "country"]),
    })).rejects.toThrow();

    await expect(asset.execute(createMissingInput(), {
      perFieldOverrides: Object.freeze([
        Object.freeze({ fieldName: "city", strategy: "leave" }),
        Object.freeze({ fieldName: "city", strategy: "fill-constant", fillValue: "x" }),
      ]),
    })).rejects.toThrow();
  });
});

