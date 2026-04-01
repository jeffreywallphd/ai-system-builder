import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizardStateAdapter } from "../DataStudioPreparationWizardStateAdapter";
import { PipelineStageIds } from "../../../../domain/dataset-studio/PipelineStageDomain";

describe("DataStudioPreparationWizardStateAdapter", () => {
  it("supports stage navigation and preserves stage configuration", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const start = adapter.getSnapshot();
    expect(start.currentStageId).toBe(PipelineStageIds.SourceSelection);

    const update = adapter.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    expect(update.ok).toBeTrue();

    const next = adapter.goNext();
    expect(next.moved).toBeTrue();
    expect(next.toStageId).toBe(PipelineStageIds.UnifiedIngestion);

    const snapshot = adapter.getSnapshot();
    expect(snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options.sourceKind).toBe("json");
  });

  it("supports wizard-to-canvas handoff metadata", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const handoff = adapter.toCanvasHandoff();

    expect(handoff.currentStageId).toBe(PipelineStageIds.SourceSelection);
    expect(handoff.authoringGraph.nodes.length).toBeGreaterThan(0);
    expect(handoff.asset.identity.kind).toBe("unified-preparation");
  });
});

