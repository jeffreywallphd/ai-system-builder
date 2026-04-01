import { PipelineStageIds, type PipelineStageConfigMode } from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import {
  UnifiedPreparationAssetKinds,
  UnifiedPreparationStageActivationModes,
  type UnifiedPreparationAssetDefinition,
  type UnifiedPreparationStageConfig,
} from "../../domain/dataset-studio/UnifiedPreparationAsset";

export function createDefaultDataStudioPreparationAssetDefinition(
  stageRegistry: PipelineStageRegistry = new PipelineStageRegistry(),
): UnifiedPreparationAssetDefinition {
  const stageDefinitions = stageRegistry.listDefinitions();
  const stages = Object.freeze(stageDefinitions.map((definition) => Object.freeze({
    stageId: definition.id,
    visibility: definition.defaultEnabled ? "simple" : "advanced",
    configMode: (definition.defaultEnabled ? "simple" : "advanced") as PipelineStageConfigMode,
    activation: Object.freeze({
      mode: definition.defaultEnabled
        ? UnifiedPreparationStageActivationModes.always
        : UnifiedPreparationStageActivationModes.disabled,
    }),
    options: Object.freeze({}),
  } satisfies UnifiedPreparationStageConfig)));

  return Object.freeze({
    identity: Object.freeze({
      assetId: "data-studio.preparation.default",
      versionId: "1.0.0",
      kind: UnifiedPreparationAssetKinds.unifiedPreparation,
    }),
    versioning: Object.freeze({
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
    }),
    upstreamBindings: Object.freeze([
      Object.freeze({
        pipelineAssetId: "pipeline.tabular-cleaning.v1",
      }),
    ]),
    stages: Object.freeze(stages.map((stage) => (
      stage.stageId === PipelineStageIds.StoragePrepared
        ? Object.freeze({
          ...stage,
          options: Object.freeze({
            destination: "prepared://dataset",
          }),
        })
        : stage
    ))),
    output: Object.freeze({
      preparedAssetId: "data-studio.prepared.default",
      outputShapeKind: "records",
    }),
    storageTarget: Object.freeze({
      targetId: "prepared://dataset",
    }),
    lineage: Object.freeze({
      upstreamAssetIds: Object.freeze(["pipeline.tabular-cleaning.v1"]),
      reusableAsAsset: true,
    }),
    preview: Object.freeze({
      previewEnabled: true,
      inspectionEnabled: true,
      previewSampleSize: 50,
    }),
  });
}
