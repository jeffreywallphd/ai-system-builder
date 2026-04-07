import { describe, expect, it } from "bun:test";
import { DatasetPipelineStageExecutionModes, DatasetPipelineStageKinds, type DatasetPipelineStageDefinition } from "../../../domain/dataset-studio/StagePipelineDomain";
import { CanonicalDataShapeKinds } from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  StageMetadataPropagationPayloadSchema,
  StageMetadataSchema,
  createStageContractFromDefinition,
  createStageMetadataFromDefinition,
  createStageMetadataPropagationPayload,
  mergePropagationPayloads,
} from "../StageMetadataContracts";

function createStage(stageId: string, order: number): DatasetPipelineStageDefinition {
  return Object.freeze({
    id: stageId,
    kind: DatasetPipelineStageKinds.ingestion,
    order,
    name: `Stage ${order}`,
    description: `Stage ${order} description`,
    dataContract: Object.freeze({
      acceptedInputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
      producedOutputShapeKinds: Object.freeze([CanonicalDataShapeKinds.records]),
    }),
    assetReferences: Object.freeze([
      Object.freeze({ assetId: "unified-ingestion" }),
    ]),
    executionPolicy: Object.freeze({
      mode: DatasetPipelineStageExecutionModes.required,
      skipByDefault: false,
    }),
  });
}

describe("StageMetadataContracts", () => {
  it("validates stage metadata model from stage definitions", () => {
    const metadata = createStageMetadataFromDefinition(createStage("ingestion", 1));
    const parsed = StageMetadataSchema.parse(metadata);

    expect(parsed.stageId).toBe("ingestion");
    expect(parsed.stageKind).toBe("ingestion");
    expect(parsed.status.marker).toBe("pending");
  });

  it("validates simple and composite mapped contracts with canonical shape compatibility", () => {
    const stage = createStage("normalization", 2);
    const simple = createStageContractFromDefinition(stage);
    const composite = createStageContractFromDefinition(stage, {
      mappedChildren: Object.freeze([
        Object.freeze({
          key: "records",
          stage: createStage("child-stage", 3),
        }),
      ]),
    });

    expect(simple.kind).toBe("simple");
    expect(simple.input.shapeKinds).toContain(CanonicalDataShapeKinds.records);
    expect(composite.kind).toBe("composite-mapped");
    expect(composite.output.shapeKinds).toContain(CanonicalDataShapeKinds.records);
  });

  it("creates and merges metadata propagation payloads for upstream-downstream stage tracking", () => {
    const payload = createStageMetadataPropagationPayload({
      stageId: "ingestion",
      stageOutput: Object.freeze({
        detectedSourceKind: "json",
        outputTarget: "records",
        canonicalOutputKind: "records",
        schemaKnown: true,
        pipelineId: "template-elt-pipeline",
        lineageId: "lineage-1",
      }),
    });

    expect(payload).toBeDefined();
    const parsed = StageMetadataPropagationPayloadSchema.parse(payload);
    expect(parsed.detectedDataType).toBe("json");
    expect(parsed.lineage.pipelineId).toBe("template-elt-pipeline");

    const merged = mergePropagationPayloads(parsed, StageMetadataPropagationPayloadSchema.parse({
      fromStageId: "raw-storage",
      storageReference: "raw://stage-1",
      lineage: { upstreamStageIds: ["raw-storage"] },
    }));
    expect(merged.storageReference).toBe("raw://stage-1");
    expect(merged.lineage.upstreamStageIds).toContain("raw-storage");
  });
});
