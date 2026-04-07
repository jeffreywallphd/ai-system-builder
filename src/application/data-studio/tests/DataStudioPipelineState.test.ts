import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizard } from "../DataStudioPreparationWizard";
import {
  createDataStudioPipelineState,
  deserializeDataStudioPipelineState,
  serializeDataStudioPipelineState,
} from "../DataStudioPipelineState";
import { PipelineStageIds } from "../../../domain/dataset-studio/PipelineStageDomain";

describe("DataStudioPipelineState", () => {
  it("builds a valid persistent state from wizard snapshots and round-trips serialization", () => {
    const wizard = new DataStudioPreparationWizard();
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    wizard.goNext();
    const state = wizard.exportPipelineState();

    expect(state.kind).toBe("data-studio-pipeline-state");
    expect(state.identity.assetId).toBe(state.unifiedPreparationAsset.identity.assetId);
    expect(state.flow.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(state.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options.sourceKind).toBe("json");
    expect(state.assetBindings.length).toBeGreaterThan(0);
    expect(state.preparedDatasetLineage.output.preparedAssetId).toBe(state.unifiedPreparationAsset.output.preparedAssetId);
    expect(state.preparedDatasetReuse.assetId).toBe(state.preparedDatasetLineage.output.preparedAssetId);

    const serialized = serializeDataStudioPipelineState(state);
    const rehydrated = deserializeDataStudioPipelineState(serialized);
    expect(rehydrated.flow.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(rehydrated.identity.revision).toBe(state.identity.revision);
    expect(rehydrated.preparedDatasetReuse.lineageId).toBe(rehydrated.preparedDatasetLineage.lineageId);
  });

  it("rejects invalid pipeline states that disable required stages", () => {
    const wizard = new DataStudioPreparationWizard();
    const state = wizard.exportPipelineState();
    const invalid = {
      ...state,
      stages: state.stages.map((stage) => (
        stage.stageId === PipelineStageIds.StoragePrepared
          ? Object.freeze({
            ...stage,
            enabled: false,
          })
          : stage
      )),
    };

    expect(() => createDataStudioPipelineState(invalid)).toThrow("Required stage");
  });

  it("restores wizard authoring state from persisted pipeline state", () => {
    const sourceWizard = new DataStudioPreparationWizard();
    sourceWizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://docs",
      sourceKind: "document",
    }));
    sourceWizard.goNext();
    const persisted = sourceWizard.exportPipelineStateJson();

    const restoredWizard = new DataStudioPreparationWizard();
    restoredWizard.importPipelineState(persisted);
    const restored = restoredWizard.getSnapshot();
    expect(restored.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(restored.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options.sourceKind).toBe("document");
  });
});
