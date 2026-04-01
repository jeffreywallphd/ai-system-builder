import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizardStateAdapter } from "../DataStudioPreparationWizardStateAdapter";
import { PipelineStageIds } from "../../../../domain/dataset-studio/PipelineStageDomain";

describe("DataStudioPreparationWizardStateAdapter", () => {
  it("lists and applies intent templates", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const templates = adapter.listTemplates();
    expect(templates.map((template) => template.id)).toEqual([
      "elt-pipeline",
      "analytics-pipeline",
      "document-pipeline",
      "image-pipeline",
    ]);

    const apply = adapter.selectTemplate("image-pipeline");
    expect(apply.ok).toBeTrue();
    expect(adapter.getSnapshot().template.id).toBe("image-pipeline");
  });

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

  it("exports and re-imports persistent pipeline state", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    adapter.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    adapter.goNext();

    const serialized = adapter.exportPipelineStateJson();
    const restored = new DataStudioPreparationWizardStateAdapter({
      persistedState: serialized,
    });
    const snapshot = restored.getSnapshot();
    expect(snapshot.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection)?.options.sourceKind).toBe("json");
  });
});

