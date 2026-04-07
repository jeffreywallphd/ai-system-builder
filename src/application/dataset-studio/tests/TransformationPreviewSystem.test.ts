import { describe, expect, it } from "bun:test";
import { createCanonicalRecordsShape } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  FieldMappingAsset,
  FilteringAsset,
  previewTransformationPipeline,
  type TransformationPipelinePreviewResult,
  registerTransformationAssets,
} from "../core/data/transformation";

function createPreviewInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "r1", fields: Object.freeze({ name: "Alice", status: "active", age: "42" }) },
        { recordId: "r2", fields: Object.freeze({ name: "Bob", status: "inactive", age: "18" }) },
        { recordId: "r3", fields: Object.freeze({ name: "Cara", status: "active", age: null }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("Transformation preview system", () => {
  it("returns normalized single-asset preview contracts with summary/samples/diffs/extensions", async () => {
    const asset = new FieldMappingAsset();
    const preview = await asset.preview(createPreviewInput(), {
      mappings: Object.freeze([
        Object.freeze({ sourceField: "name", targetField: "fullName" }),
      ]),
      preserveUnmapped: true,
      dropEmptyTargets: false,
      previewSampleSize: 2,
    });

    expect(preview.normalized.contractVersion).toBe("1.0.0");
    expect(preview.normalized.asset.assetId).toBe("field-mapping");
    expect(preview.normalized.summary.inputRowCount).toBe(3);
    expect(preview.normalized.summary.outputRowCount).toBe(3);
    expect(preview.normalized.summary.changedFieldCount).toBeGreaterThan(0);
    expect(preview.normalized.samples.inputRows.length).toBe(3);
    expect(preview.normalized.samples.outputRows.length).toBe(3);
    expect(preview.normalized.extensions?.mapping).toBeDefined();
    expect(preview.normalized.diffs?.structuredPatch?.kind).toBe("json");
  });

  it("captures row removals and deterministic sampling in normalized summaries", async () => {
    const asset = new FilteringAsset();
    const preview = await asset.preview(createPreviewInput(), {
      mode: "include",
      logicalOperator: "and",
      conditions: Object.freeze([
        Object.freeze({ fieldName: "status", operator: "equals", value: "active" }),
      ]),
      previewSampleSize: 2,
    });

    expect(preview.sample.kind).toBe("records");
    expect(preview.normalized.summary.inputRowCount).toBe(3);
    expect(preview.normalized.summary.outputRowCount).toBe(2);
    expect(preview.normalized.summary.removedRowCount).toBe(1);
    expect(preview.normalized.summary.addedRowCount).toBe(0);
  });

  it("aggregates per-step normalized previews into pipeline-level normalized preview contracts", async () => {
    const result = await previewTransformationPipeline(
      createPreviewInput(),
      Object.freeze([
        Object.freeze({
          stepId: "map",
          asset: new FieldMappingAsset(),
          config: Object.freeze({
            mappings: Object.freeze([
              Object.freeze({ sourceField: "name", targetField: "fullName" }),
            ]),
            preserveUnmapped: true,
            dropEmptyTargets: false,
            previewSampleSize: 3,
          }),
        }),
        Object.freeze({
          stepId: "filter",
          asset: new FilteringAsset(),
          config: Object.freeze({
            mode: "include",
            logicalOperator: "and",
            conditions: Object.freeze([
              Object.freeze({ fieldName: "status", operator: "equals", value: "active" }),
            ]),
            previewSampleSize: 3,
          }),
        }),
      ]),
      { sampleSize: 3, sampleSizePerStep: 3 },
    );

    const normalized: TransformationPipelinePreviewResult["normalized"] = result.normalized;
    expect(normalized.contractVersion).toBe("1.0.0");
    expect(normalized.summary.stepCount).toBe(2);
    expect(normalized.steps[0]?.preview?.asset.assetId).toBe("field-mapping");
    expect(normalized.steps[1]?.preview?.asset.assetId).toBe("filtering");
    expect(normalized.summary.changedFields.length).toBeGreaterThan(0);
    expect(result.steps[0]?.preview?.contractVersion).toBe("1.0.0");
  });

  it("supports empty dataset previews without contract drift", async () => {
    const { registry } = registerTransformationAssets();
    const mappingAsset = registry.get({ id: "field-mapping" })?.asset;
    expect(mappingAsset).toBeDefined();
    const preview = await mappingAsset!.preview(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {
      mappings: Object.freeze([]),
      preserveUnmapped: true,
      dropEmptyTargets: false,
      previewSampleSize: 5,
    });

    expect(preview.normalized.summary.inputRowCount).toBe(0);
    expect(preview.normalized.summary.outputRowCount).toBe(0);
    expect(preview.normalized.samples.inputRows).toHaveLength(0);
    expect(preview.normalized.samples.outputRows).toHaveLength(0);
  });
});

