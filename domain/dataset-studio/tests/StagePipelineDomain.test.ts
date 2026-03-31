import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../CanonicalDataShapes";
import {
  DatasetPipelineStageExecutionModes,
  DatasetPipelineStageKinds,
  createDatasetPipelineDefinition,
  createUnifiedIngestionStagePipelineDefinition,
} from "../StagePipelineDomain";

describe("StagePipelineDomain", () => {
  it("creates the default unified ingestion stage pipeline in deterministic order", () => {
    const pipeline = createUnifiedIngestionStagePipelineDefinition();
    expect(pipeline.pipelineId).toBe("dataset-unified-ingestion");
    expect(pipeline.stages.map((stage) => stage.id)).toEqual([
      "source-selection",
      "ingestion",
      "raw-storage",
      "profiling",
      "normalization",
      "preview",
    ]);
    expect(pipeline.stages[1]?.executionPolicy.mode).toBe("conditional");
  });

  it("rejects conditional stages without a condition id", () => {
    expect(() => createDatasetPipelineDefinition({
      pipelineId: "invalid-pipeline",
      name: "Invalid",
      stages: Object.freeze([
        Object.freeze({
          id: "ingestion",
          kind: DatasetPipelineStageKinds.ingestion,
          order: 1,
          name: "Ingestion",
          description: "Invalid conditional stage",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([
            Object.freeze({ assetId: "csv-ingestor" }),
          ]),
          executionPolicy: Object.freeze({
            mode: DatasetPipelineStageExecutionModes.conditional,
          }),
        }),
      ]),
    })).toThrow("requires a non-empty conditionId");
  });

  it("rejects duplicate stage ids and duplicate stage order values", () => {
    expect(() => createDatasetPipelineDefinition({
      pipelineId: "duplicate-stage-id",
      name: "Invalid",
      stages: Object.freeze([
        Object.freeze({
          id: "ingestion",
          kind: DatasetPipelineStageKinds.ingestion,
          order: 1,
          name: "Ingestion",
          description: "Stage one",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([
            Object.freeze({ assetId: "csv-ingestor" }),
          ]),
          executionPolicy: Object.freeze({
            mode: DatasetPipelineStageExecutionModes.required,
          }),
        }),
        Object.freeze({
          id: "ingestion",
          kind: DatasetPipelineStageKinds.normalization,
          order: 2,
          name: "Normalization",
          description: "Stage two",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([
            Object.freeze({ assetId: "unified-ingestion" }),
          ]),
          executionPolicy: Object.freeze({
            mode: DatasetPipelineStageExecutionModes.required,
          }),
        }),
      ]),
    })).toThrow("duplicate stage id");

    expect(() => createDatasetPipelineDefinition({
      pipelineId: "duplicate-stage-order",
      name: "Invalid",
      stages: Object.freeze([
        Object.freeze({
          id: "stage-a",
          kind: DatasetPipelineStageKinds.ingestion,
          order: 1,
          name: "A",
          description: "Stage A",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([
            Object.freeze({ assetId: "csv-ingestor" }),
          ]),
          executionPolicy: Object.freeze({
            mode: DatasetPipelineStageExecutionModes.required,
          }),
        }),
        Object.freeze({
          id: "stage-b",
          kind: DatasetPipelineStageKinds.normalization,
          order: 1,
          name: "B",
          description: "Stage B",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([
            Object.freeze({ assetId: "unified-ingestion" }),
          ]),
          executionPolicy: Object.freeze({
            mode: DatasetPipelineStageExecutionModes.required,
          }),
        }),
      ]),
    })).toThrow("duplicate stage order");
  });

  it("keeps raw-storage stage definitions valid in unified pipeline", () => {
    const pipeline = createUnifiedIngestionStagePipelineDefinition();
    const rawStorage = pipeline.stages.find((stage) => stage.kind === DatasetPipelineStageKinds.rawStorage);
    expect(rawStorage).toBeDefined();
    expect(rawStorage?.assetReferences[0]?.assetId).toBe("raw-storage-stage");
  });

  it("maps profiling stage definitions to the data profiling transformation asset", () => {
    const pipeline = createUnifiedIngestionStagePipelineDefinition();
    const profiling = pipeline.stages.find((stage) => stage.kind === DatasetPipelineStageKinds.profiling);
    expect(profiling).toBeDefined();
    expect(profiling?.assetReferences[0]?.assetId).toBe("data-profiling");
  });

  it("maps normalization stage definitions to the type normalization transformation asset", () => {
    const pipeline = createUnifiedIngestionStagePipelineDefinition();
    const normalization = pipeline.stages.find((stage) => stage.kind === DatasetPipelineStageKinds.normalization);
    expect(normalization).toBeDefined();
    expect(normalization?.assetReferences[0]?.assetId).toBe("type-normalization");
  });
});
