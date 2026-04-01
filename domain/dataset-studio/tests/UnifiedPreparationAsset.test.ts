import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../CanonicalDataShapes";
import { PipelineStageIds } from "../PipelineStageDomain";
import {
  UnifiedPreparationAssetKinds,
  UnifiedPreparationStageActivationModes,
  createUnifiedPreparationAssetDefinition,
} from "../UnifiedPreparationAsset";

function createValidDefinition() {
  return {
    identity: {
      assetId: "prep.asset.v1",
      versionId: "1.0.0",
      kind: UnifiedPreparationAssetKinds.unifiedPreparation,
    },
    versioning: {
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
    },
    upstreamBindings: Object.freeze([
      Object.freeze({
        pipelineAssetId: "pipeline.tabular-cleaning.v1",
      }),
    ]),
    stages: Object.freeze([
      Object.freeze({
        stageId: PipelineStageIds.SourceSelection,
        visibility: "simple",
        configMode: "simple",
        activation: { mode: "always" },
        options: {},
      }),
      Object.freeze({
        stageId: PipelineStageIds.UnifiedIngestion,
        visibility: "simple",
        configMode: "advanced",
        activation: { mode: "always" },
        options: { strategy: "auto" },
      }),
      Object.freeze({
        stageId: PipelineStageIds.StoragePrepared,
        visibility: "simple",
        configMode: "simple",
        activation: { mode: "always" },
        options: { destination: "prepared://default" },
      }),
    ]),
    output: {
      preparedAssetId: "prepared.dataset.v1",
      outputShapeKind: CanonicalDataShapeKinds.records,
    },
    lineage: {
      upstreamAssetIds: Object.freeze(["pipeline.tabular-cleaning.v1"]),
      reusableAsAsset: true,
    },
    preview: {
      previewEnabled: true,
      inspectionEnabled: true,
      previewSampleSize: 100,
    },
  } as const;
}

describe("UnifiedPreparationAsset", () => {
  it("creates a valid unified preparation asset definition", () => {
    const definition = createUnifiedPreparationAssetDefinition(createValidDefinition());
    expect(definition.identity.kind).toBe(UnifiedPreparationAssetKinds.unifiedPreparation);
    expect(definition.stages.map((stage) => stage.stageId)).toContain(PipelineStageIds.StoragePrepared);
  });

  it("rejects definitions missing required stages", () => {
    const input = createValidDefinition();
    const withoutPrepared = {
      ...input,
      stages: input.stages.filter((stage) => stage.stageId !== PipelineStageIds.StoragePrepared),
    };
    expect(() => createUnifiedPreparationAssetDefinition(withoutPrepared)).toThrow(
      "missing required stage",
    );
  });

  it("rejects conditional stage activation without condition id", () => {
    const input = createValidDefinition();
    const conditionalMissingId = {
      ...input,
      stages: [
        ...input.stages,
        {
          stageId: PipelineStageIds.Classification,
          visibility: "advanced",
          configMode: "advanced",
          activation: { mode: UnifiedPreparationStageActivationModes.conditional },
          options: {},
        },
      ],
    } as const;

    expect(() => createUnifiedPreparationAssetDefinition(conditionalMissingId)).toThrow(
      "requires conditionId",
    );
  });

  it("rejects definitions without prepared storage target configuration", () => {
    const input = createValidDefinition();
    const withoutStorageTarget = {
      ...input,
      stages: input.stages.map((stage) => (
        stage.stageId === PipelineStageIds.StoragePrepared
          ? {
            ...stage,
            options: {},
          }
          : stage
      )),
    };

    expect(() => createUnifiedPreparationAssetDefinition(withoutStorageTarget)).toThrow(
      "requires storageTarget.targetId",
    );
  });
});
