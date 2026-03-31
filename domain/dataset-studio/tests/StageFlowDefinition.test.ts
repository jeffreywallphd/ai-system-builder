import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../CanonicalDataShapes";
import {
  DatasetPipelineStageExecutionModes,
  DatasetPipelineStageKinds,
  createDatasetPipelineDefinition,
} from "../StagePipelineDomain";
import {
  createStageFlowDefinition,
  insertStageInFlow,
  removeStageFromFlow,
  reorderFlowStages,
} from "../StageFlowDefinition";

function createBaseFlow() {
  const pipeline = createDatasetPipelineDefinition({
    pipelineId: "stage-flow-test",
    name: "Stage Flow Test",
    stages: Object.freeze([
      Object.freeze({
        id: "source",
        kind: DatasetPipelineStageKinds.source,
        order: 1,
        name: "Source",
        description: "Source",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
        }),
        assetReferences: Object.freeze([Object.freeze({ assetId: "unified-ingestion" })]),
        executionPolicy: Object.freeze({ mode: DatasetPipelineStageExecutionModes.required }),
      }),
      Object.freeze({
        id: "ingestion",
        kind: DatasetPipelineStageKinds.ingestion,
        order: 2,
        name: "Ingestion",
        description: "Ingestion",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
        }),
        assetReferences: Object.freeze([Object.freeze({ assetId: "csv-ingestor" })]),
        executionPolicy: Object.freeze({ mode: DatasetPipelineStageExecutionModes.required }),
      }),
      Object.freeze({
        id: "prepared",
        kind: DatasetPipelineStageKinds.preparedStorage,
        order: 3,
        name: "Prepared",
        description: "Prepared",
        dataContract: Object.freeze({
          acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
        }),
        assetReferences: Object.freeze([Object.freeze({ assetId: "unified-ingestion" })]),
        executionPolicy: Object.freeze({ mode: DatasetPipelineStageExecutionModes.required }),
      }),
    ]),
  });

  return createStageFlowDefinition({
    flowId: pipeline.pipelineId,
    name: pipeline.name,
    description: pipeline.description,
    stages: pipeline.stages,
    conditionalTransitions: Object.freeze([
      Object.freeze({
        id: "source-direct-prepared",
        fromStageId: "source",
        toStageId: "prepared",
        conditionId: "skip-ingestion",
        priority: 1,
      }),
    ]),
  });
}

describe("StageFlowDefinition", () => {
  it("supports insertion, removal, and reorder operations", () => {
    const flow = createBaseFlow();
    const inserted = insertStageInFlow(flow, Object.freeze({
      ...flow.stages[1],
      id: "quality",
      name: "Quality",
      order: 99,
      kind: DatasetPipelineStageKinds.cleaning,
    }), 3);

    expect(inserted.stages.map((stage) => stage.id)).toEqual([
      "source",
      "ingestion",
      "quality",
      "prepared",
    ]);

    const reordered = reorderFlowStages(inserted, Object.freeze([
      "source",
      "quality",
      "ingestion",
      "prepared",
    ]));
    expect(reordered.stages.map((stage) => stage.id)).toEqual([
      "source",
      "quality",
      "ingestion",
      "prepared",
    ]);

    const removed = removeStageFromFlow(reordered, "quality");
    expect(removed.stages.map((stage) => stage.id)).toEqual([
      "source",
      "ingestion",
      "prepared",
    ]);
  });

  it("rejects incompatible transition contracts", () => {
    expect(() => createStageFlowDefinition({
      flowId: "invalid-flow",
      name: "Invalid",
      stages: Object.freeze([
        Object.freeze({
          id: "a",
          kind: DatasetPipelineStageKinds.source,
          order: 1,
          name: "A",
          description: "A",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
          }),
          assetReferences: Object.freeze([Object.freeze({ assetId: "unified-ingestion" })]),
          executionPolicy: Object.freeze({ mode: DatasetPipelineStageExecutionModes.required }),
        }),
        Object.freeze({
          id: "b",
          kind: DatasetPipelineStageKinds.extraction,
          order: 2,
          name: "B",
          description: "B",
          dataContract: Object.freeze({
            acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.textItems]),
            producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.textItems]),
          }),
          assetReferences: Object.freeze([Object.freeze({ assetId: "unified-ingestion" })]),
          executionPolicy: Object.freeze({ mode: DatasetPipelineStageExecutionModes.required }),
        }),
      ]),
      conditionalTransitions: Object.freeze([]),
    })).toThrow("produced output kinds do not satisfy accepted input kinds");
  });
});
