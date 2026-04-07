import { describe, expect, it } from "bun:test";
import {
  createCanonicalRecordsShape,
  createCanonicalTableShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  AggregationAsset,
  AggregationOperations,
  executeTransformationPipeline,
  executeTransformationPipelineDefinition,
  previewTransformationPipeline,
  previewTransformationPipelineDefinition,
  registerTransformationAssets,
  type TransformationPipelineDefinition,
} from "../core/data/transformation";
import { FilteringAsset } from "../core/data/transformation/assets/FilteringAsset";

function createAggregationRecordsInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "r1", fields: Object.freeze({ segment: "A", revenue: 100, userId: "u1", score: 9, city: "Boston" }) },
        { recordId: "r2", fields: Object.freeze({ segment: "A", revenue: 150, userId: "u2", score: null, city: "Boston" }) },
        { recordId: "r3", fields: Object.freeze({ segment: "B", revenue: 40, userId: "u3", score: 7, city: "Austin" }) },
        { recordId: "r4", fields: Object.freeze({ segment: "B", revenue: null, userId: "u3", score: 6, city: "Austin" }) },
        { recordId: "r5", fields: Object.freeze({ segment: "B", revenue: 10, userId: null, score: 3, city: "Austin" }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

function createSparseAggregationInput() {
  return Object.freeze({
    data: createCanonicalRecordsShape({
      records: Object.freeze([
        { recordId: "r1", fields: Object.freeze({ segment: "A", revenue: "100", note: "x" }) },
        { recordId: "r2", fields: Object.freeze({ segment: "A", revenue: "n/a", note: "y" }) },
      ]),
      metadata: { schemaVersion: "1.0.0" },
    }),
  });
}

describe("AggregationAsset", () => {
  it("aggregates grouped records with count/sum/avg/min/max/distinct/first/last", async () => {
    const asset = new AggregationAsset();
    const output = await asset.execute(createAggregationRecordsInput(), {
      groupByFields: Object.freeze(["segment"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.count, outputField: "row_count" }),
        Object.freeze({ operation: AggregationOperations.sum, sourceField: "revenue", outputField: "revenue_sum" }),
        Object.freeze({ operation: AggregationOperations.avg, sourceField: "revenue", outputField: "revenue_avg" }),
        Object.freeze({ operation: AggregationOperations.min, sourceField: "score", outputField: "score_min" }),
        Object.freeze({ operation: AggregationOperations.max, sourceField: "score", outputField: "score_max" }),
        Object.freeze({ operation: AggregationOperations.distinctCount, sourceField: "userId", outputField: "distinct_users" }),
        Object.freeze({ operation: AggregationOperations.first, sourceField: "city", outputField: "first_city" }),
        Object.freeze({ operation: AggregationOperations.last, sourceField: "city", outputField: "last_city" }),
      ]),
      previewSampleSize: 5,
    });

    expect(output.data.kind).toBe("records");
    expect(output.aggregation.inputRowCount).toBe(5);
    expect(output.aggregation.outputRowCount).toBe(2);
    expect(output.aggregation.operationsApplied).toHaveLength(8);

    if (output.data.kind === "records") {
      const segmentA = output.data.records.find((record) => record.fields.segment === "A");
      const segmentB = output.data.records.find((record) => record.fields.segment === "B");
      expect(segmentA?.fields.row_count).toBe(2);
      expect(segmentA?.fields.revenue_sum).toBe(250);
      expect(segmentA?.fields.revenue_avg).toBe(125);
      expect(segmentA?.fields.score_min).toBe(9);
      expect(segmentA?.fields.score_max).toBe(9);
      expect(segmentA?.fields.distinct_users).toBe(2);
      expect(segmentA?.fields.first_city).toBe("Boston");
      expect(segmentA?.fields.last_city).toBe("Boston");
      expect(segmentB?.fields.row_count).toBe(3);
      expect(segmentB?.fields.revenue_sum).toBe(50);
      expect(segmentB?.fields.revenue_avg).toBe(25);
      expect(segmentB?.fields.score_min).toBe(3);
      expect(segmentB?.fields.score_max).toBe(7);
      expect(segmentB?.fields.distinct_users).toBe(1);
    }

    expect(output.preview.representativeRows.length).toBe(2);
    expect(output.sampleRows.length).toBe(2);
    expect(output.aggregation.ignoredFieldNames).toContain("city");
  });

  it("supports multi-field grouping and table output compatibility", async () => {
    const asset = new AggregationAsset();
    const input = Object.freeze({
      data: createCanonicalTableShape({
        columns: Object.freeze([
          { columnId: "segment", label: "segment", valueType: "string" },
          { columnId: "region", label: "region", valueType: "string" },
          { columnId: "revenue", label: "revenue", valueType: "number" },
        ]),
        rows: Object.freeze([
          { rowId: "1", cells: Object.freeze({ segment: "A", region: "east", revenue: 10 }) },
          { rowId: "2", cells: Object.freeze({ segment: "A", region: "east", revenue: 15 }) },
          { rowId: "3", cells: Object.freeze({ segment: "A", region: "west", revenue: 20 }) },
        ]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    });

    const output = await asset.execute(input, {
      groupByFields: Object.freeze(["segment", "region"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.count, outputField: "count" }),
        Object.freeze({ operation: AggregationOperations.sum, sourceField: "revenue", outputField: "revenue_sum" }),
      ]),
    });

    expect(output.data.kind).toBe("table");
    if (output.data.kind === "table") {
      expect(output.data.rows).toHaveLength(2);
      expect(output.data.columns.map((column) => column.columnId)).toEqual(["segment", "region", "count", "revenue_sum"]);
    }
  });

  it("reports skipped invalid numeric aggregations and null handling behavior", async () => {
    const asset = new AggregationAsset();
    const output = await asset.execute(createSparseAggregationInput(), {
      groupByFields: Object.freeze(["segment"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.sum, sourceField: "revenue", outputField: "revenue_sum" }),
        Object.freeze({ operation: AggregationOperations.count, sourceField: "revenue", outputField: "revenue_non_null_count" }),
      ]),
      nullHandlingMode: "exclude",
    });

    expect(output.aggregation.skippedAggregations).toHaveLength(1);
    expect(output.aggregation.skippedAggregations[0]?.outputField).toBe("revenue_sum");
    if (output.data.kind === "records") {
      expect(output.data.records[0]?.fields.revenue_sum).toBeNull();
      expect(output.data.records[0]?.fields.revenue_non_null_count).toBe(2);
    }
  });

  it("validates duplicate and invalid config requests", async () => {
    const asset = new AggregationAsset();
    await expect(asset.execute(createAggregationRecordsInput(), {
      groupByFields: Object.freeze(["segment", "segment"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.count, outputField: "count" }),
      ]),
    })).rejects.toThrow();

    await expect(asset.execute(createAggregationRecordsInput(), {
      groupByFields: Object.freeze(["segment"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.sum, outputField: "sum_value" }),
      ]),
    })).rejects.toThrow();
  });

  it("handles empty datasets deterministically", async () => {
    const asset = new AggregationAsset();
    const output = await asset.execute(Object.freeze({
      data: createCanonicalRecordsShape({
        records: Object.freeze([]),
        metadata: { schemaVersion: "1.0.0" },
      }),
    }), {
      groupByFields: Object.freeze(["segment"]),
      aggregations: Object.freeze([
        Object.freeze({ operation: AggregationOperations.count, outputField: "count" }),
      ]),
    });

    expect(output.aggregation.inputRowCount).toBe(0);
    expect(output.aggregation.outputRowCount).toBe(0);
    expect(output.sampleRows).toHaveLength(0);
  });
});

describe("Transformation pipeline orchestration", () => {
  it("executes mixed transformation chain with per-step summaries", async () => {
    const pipelineResult = await executeTransformationPipeline(
      createAggregationRecordsInput(),
      Object.freeze([
        Object.freeze({
          stepId: "filter-active-segment",
          asset: new FilteringAsset(),
          config: Object.freeze({
            mode: "include",
            logicalOperator: "and",
            conditions: Object.freeze([
              Object.freeze({ fieldName: "segment", operator: "in", values: Object.freeze(["A", "B"]) }),
            ]),
          }),
        }),
        Object.freeze({
          stepId: "aggregate",
          asset: new AggregationAsset(),
          config: Object.freeze({
            groupByFields: Object.freeze(["segment"]),
            aggregations: Object.freeze([
              Object.freeze({ operation: AggregationOperations.count, outputField: "count" }),
              Object.freeze({ operation: AggregationOperations.sum, sourceField: "revenue", outputField: "revenue_sum" }),
            ]),
          }),
        }),
      ]),
    );

    expect(pipelineResult.status).toBe("succeeded");
    expect(pipelineResult.steps).toHaveLength(2);
    expect(pipelineResult.steps.every((step) => step.status === "succeeded")).toBeTrue();
    expect(pipelineResult.outputsByStepId["aggregate"]).toBeDefined();
    expect(pipelineResult.finalOutput?.metadata.assetId).toBe("aggregation");
  });

  it("executes and previews serializable pipeline definitions using registry references", async () => {
    const { registry } = registerTransformationAssets();
    const definition: TransformationPipelineDefinition = Object.freeze({
      pipelineId: "segment-aggregation-pipeline",
      failureMode: "stop-on-error",
      steps: Object.freeze([
        Object.freeze({
          stepId: "filter-step",
          assetId: "filtering",
          config: Object.freeze({
            mode: "include",
            logicalOperator: "and",
            conditions: Object.freeze([
              Object.freeze({ fieldName: "segment", operator: "equals", value: "A" }),
            ]),
          }),
        }),
        Object.freeze({
          stepId: "aggregate-step",
          assetId: "aggregation",
          config: Object.freeze({
            groupByFields: Object.freeze(["segment"]),
            aggregations: Object.freeze([
              Object.freeze({ operation: AggregationOperations.count, outputField: "count" }),
            ]),
          }),
        }),
      ]),
    });

    const executed = await executeTransformationPipelineDefinition(createAggregationRecordsInput(), definition, registry);
    expect(executed.status).toBe("succeeded");
    expect(executed.pipelineId).toBe("segment-aggregation-pipeline");
    expect(executed.finalOutput?.metadata.assetId).toBe("aggregation");

    const preview = await previewTransformationPipelineDefinition(createAggregationRecordsInput(), definition, registry, {
      sampleSize: 3,
      sampleSizePerStep: 3,
    });
    expect(preview.status).toBe("succeeded");
    expect(preview.steps).toHaveLength(2);
    expect(preview.outputSummary?.kind).toBe("records");
    expect(preview.finalPreviewData?.kind).toBe("records");
  });

  it("fails fast on per-step config validation errors with diagnostics", async () => {
    const { registry } = registerTransformationAssets();
    const definition: TransformationPipelineDefinition = Object.freeze({
      pipelineId: "invalid-pipeline",
      steps: Object.freeze([
        Object.freeze({
          stepId: "bad-aggregation",
          assetId: "aggregation",
          config: Object.freeze({
            groupByFields: Object.freeze(["segment"]),
            aggregations: Object.freeze([
              Object.freeze({ operation: AggregationOperations.sum, outputField: "sum" }),
            ]),
          }),
        }),
      ]),
    });

    const result = await executeTransformationPipelineDefinition(createAggregationRecordsInput(), definition, registry);
    expect(result.status).toBe("failed");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.status).toBe("failed");
    expect(result.steps[0]?.error?.issues?.length).toBeGreaterThan(0);
    expect(result.finalOutput).toBeUndefined();
  });

  it("returns failed preview when a step cannot execute and preserves step diagnostics", async () => {
    const preview = await previewTransformationPipeline(
      createAggregationRecordsInput(),
      Object.freeze([
        Object.freeze({
          stepId: "bad-aggregation",
          asset: new AggregationAsset(),
          config: Object.freeze({
            groupByFields: Object.freeze(["segment"]),
            aggregations: Object.freeze([
              Object.freeze({ operation: AggregationOperations.avg, outputField: "avg" }),
            ]),
          }),
        }),
      ]),
      { sampleSize: 2 },
    );

    expect(preview.status).toBe("failed");
    expect(preview.steps[0]?.status).toBe("failed");
    expect(preview.error).toBeDefined();
  });

  it("rejects invalid pipeline definitions with duplicate step ids", async () => {
    const { registry } = registerTransformationAssets();
    const invalidDefinition: TransformationPipelineDefinition = Object.freeze({
      pipelineId: "duplicate-step-ids",
      steps: Object.freeze([
        Object.freeze({ stepId: "dup", assetId: "aggregation", config: Object.freeze({ groupByFields: ["segment"], aggregations: [{ operation: AggregationOperations.count }] }) }),
        Object.freeze({ stepId: "dup", assetId: "aggregation", config: Object.freeze({ groupByFields: ["segment"], aggregations: [{ operation: AggregationOperations.count }] }) }),
      ]),
    });

    await expect(executeTransformationPipelineDefinition(createAggregationRecordsInput(), invalidDefinition, registry)).rejects.toThrow();
  });
});
