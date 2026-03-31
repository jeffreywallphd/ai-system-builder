import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  AggregationAsset,
  DataClassificationAsset,
  DataProfilingAsset,
  DataValidationAsset,
  DeduplicationAsset,
  executeTransformationPipeline,
  FieldMappingAsset,
  FilteringAsset,
  MissingValueHandlingAsset,
  registerTransformationAssets,
  SchemaInferenceAsset,
  SchemaInferenceModes,
  SchemaInferenceTextKinds,
  TypeNormalizationAsset,
} from "../core/data/transformation";

function createRecordsInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        {
          recordId: "1",
          fields: Object.freeze({
            name: "alpha",
            age: "40",
            subscribed: "true",
            createdAt: "2026-03-31T10:00:00.000Z",
            notes: "small",
          }),
        },
        {
          recordId: "2",
          fields: Object.freeze({
            name: "beta",
            age: 36,
            subscribed: false,
            createdAt: "2026-03-30",
            notes: "small",
          }),
        },
        {
          recordId: "3",
          fields: Object.freeze({
            name: "gamma",
            age: null,
            subscribed: "false",
            createdAt: "2026-03-29",
            notes: "A longer free text sentence that should not be treated as category.",
          }),
        },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("Transformation assets", () => {
  it("infers schema with permissive mode, type detection, nullability, and stats", async () => {
    const asset = new SchemaInferenceAsset();
    const output = await asset.execute(createRecordsInput(), {
      sampleSize: 100,
      inferenceMode: SchemaInferenceModes.permissive,
      previewSampleSize: 10,
    });

    const ageField = output.schema.fields.find((field) => field.fieldName === "age");
    const subscribedField = output.schema.fields.find((field) => field.fieldName === "subscribed");
    const createdAtField = output.schema.fields.find((field) => field.fieldName === "createdAt");
    const notesField = output.schema.fields.find((field) => field.fieldName === "notes");

    expect(ageField?.inferredType).toBe("number");
    expect(ageField?.nullable).toBeTrue();
    expect(ageField?.stats.mean).toBeDefined();
    expect(subscribedField?.inferredType).toBe("boolean");
    expect(createdAtField?.inferredType).toBe("date");
    expect(notesField?.inferredType).toBe("string");
    expect(notesField?.textKind).toBe(SchemaInferenceTextKinds.freeText);
    expect(output.sampleRows.length).toBe(3);
  });

  it("uses strict mode fallback for mixed non-null primitive types", async () => {
    const asset = new SchemaInferenceAsset();
    const mixedInput = Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([
          { recordId: "1", fields: Object.freeze({ mixed: 10 }) },
          { recordId: "2", fields: Object.freeze({ mixed: "alpha" }) },
          { recordId: "3", fields: Object.freeze({ mixed: true }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const output = await asset.execute(mixedInput, {
      sampleSize: 100,
      inferenceMode: SchemaInferenceModes.strict,
      previewSampleSize: 10,
    });
    const mixedField = output.schema.fields.find((field) => field.fieldName === "mixed");
    expect(mixedField?.inferredType).toBe("string");
  });

  it("supports table inputs and preview sampling", async () => {
    const asset = new SchemaInferenceAsset();
    const tableInput = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "segment", label: "segment", valueType: "string" },
          { columnId: "value", label: "value", valueType: "number" },
        ]),
        rows: Object.freeze([
          { rowId: "row-1", cells: Object.freeze({ segment: "A", value: 1 }) },
          { rowId: "row-2", cells: Object.freeze({ segment: "A", value: 2 }) },
          { rowId: "row-3", cells: Object.freeze({ segment: "B", value: 3 }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const preview = await asset.preview(tableInput, {
      sampleSize: 2,
      inferenceMode: SchemaInferenceModes.permissive,
      previewSampleSize: 1,
    });
    expect(preview.sample.kind).toBe("table");
    expect(preview.sample.rows.length).toBe(2);
    expect(preview.output.sampleRows.length).toBe(1);
  });

  it("registers schema inference in transformation registry and runs as a pipeline step", async () => {
    const { registry, entries } = registerTransformationAssets();
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(entries.some((entry) => entry.descriptor.id === SchemaInferenceAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === DataProfilingAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === DataClassificationAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === TypeNormalizationAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === MissingValueHandlingAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === DeduplicationAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === FilteringAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === AggregationAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === DataValidationAsset.assetId)).toBeTrue();
    expect(entries.some((entry) => entry.descriptor.id === FieldMappingAsset.assetId)).toBeTrue();

    const resolved = registry.get({ id: SchemaInferenceAsset.assetId });
    expect(resolved).toBeDefined();

    const pipelineResult = await executeTransformationPipeline(
      createRecordsInput(),
      Object.freeze([
        {
          asset: resolved!.asset,
          config: Object.freeze({
            sampleSize: 2,
            inferenceMode: SchemaInferenceModes.permissive,
            previewSampleSize: 2,
          }),
        },
      ]),
    );

    expect(pipelineResult.outputs).toHaveLength(1);
    expect(pipelineResult.finalOutput?.metadata.assetId).toBe(SchemaInferenceAsset.assetId);
    expect((pipelineResult.finalOutput as Awaited<ReturnType<SchemaInferenceAsset["execute"]>> | undefined)?.schema.fields.length).toBeGreaterThan(0);
  });
});
