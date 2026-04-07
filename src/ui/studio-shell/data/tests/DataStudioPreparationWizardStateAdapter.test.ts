import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizardStateAdapter } from "../DataStudioPreparationWizardStateAdapter";
import { PipelineStageIds } from "../../../../src/domain/dataset-studio/PipelineStageDomain";

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

  it("blocks forward progression when transition validation prerequisites fail", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const start = adapter.getSnapshot();
    expect(start.currentStageId).toBe(PipelineStageIds.SourceSelection);

    const jump = adapter.goToStage(PipelineStageIds.Transformation);
    expect(jump.moved).toBeFalse();
    expect(jump.issues.some((issue) => issue.code === "data-pipeline.transition.prerequisite-incomplete")).toBeTrue();
  });

  it("applies simple vs advanced presentation visibility to stage availability", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const targetStageId = PipelineStageIds.Enrichment;

    const setVisibility = adapter.setStageVisibility(targetStageId, "advanced");
    expect(setVisibility.ok).toBeTrue();
    adapter.setSimpleMode();

    const simpleSnapshot = adapter.getSnapshot();
    const simpleStage = simpleSnapshot.stages.find((stage) => stage.stageId === targetStageId);
    expect(simpleStage?.visibility).toBe("advanced");
    expect(simpleStage?.availability.isAvailable).toBeFalse();
    expect(["visibility", "disabled"]).toContain(simpleStage?.availability.reason);

    adapter.setAdvancedMode();
    const advancedSnapshot = adapter.getSnapshot();
    const advancedStage = advancedSnapshot.stages.find((stage) => stage.stageId === targetStageId);
    expect(advancedStage?.visibility).toBe("advanced");
  });

  it("supports wizard-to-canvas handoff metadata", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const handoff = adapter.toCanvasHandoff();
    const projection = adapter.toCanvasProjection();

    expect(handoff.currentStageId).toBe(PipelineStageIds.SourceSelection);
    expect(handoff.authoringGraph.nodes.length).toBeGreaterThan(0);
    expect(handoff.asset.identity.kind).toBe("unified-preparation");
    expect(handoff.stages.length).toBeGreaterThan(0);
    expect(projection.graph.source).toBe("canvas");
    expect(projection.graph.nodes.length).toBe(handoff.authoringGraph.nodes.length);
  });

  it("resolves stage-level canvas and internals snapshots from live wizard state", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const nodeId = adapter.findCanvasNodeIdForStage(PipelineStageIds.SourceSelection);
    const internals = adapter.getStageInternals(PipelineStageIds.SourceSelection);

    expect(typeof nodeId).toBe("string");
    expect(internals?.stageId).toBe(PipelineStageIds.SourceSelection);
    expect(internals?.nodeIds.length).toBeGreaterThan(0);
    expect(Array.isArray(internals?.incomingEdgeIds)).toBeTrue();
    expect(Array.isArray(internals?.outgoingEdgeIds)).toBeTrue();
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

  it("migrates legacy dataset definitions into Data Studio wizard state", () => {
    const restored = new DataStudioPreparationWizardStateAdapter({
      persistedState: JSON.stringify({ datasetSpec: { format: "jsonl", schema: {}, source: "dataset:legacy:v1" } }),
    });
    const snapshot = restored.getSnapshot();
    expect(snapshot.currentStageId).toBe(PipelineStageIds.SourceSelection);
    const sourceSelection = snapshot.stages.find((stage) => stage.stageId === PipelineStageIds.SourceSelection);
    expect(sourceSelection?.options.sourceKind).toBe("json");
    expect(sourceSelection?.options.sourceReference).toBe("dataset:legacy:v1");
  });

  it("surfaces execution readiness diagnostics from the canonical pipeline validation service", () => {
    const adapter = new DataStudioPreparationWizardStateAdapter();
    const blocked = adapter.assessExecutionReadiness();
    expect(blocked.executionReady).toBeFalse();
    expect(blocked.blockingIssues.length).toBeGreaterThan(0);

    adapter.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceAssetId: "asset:source-customers:v1",
    }));
    adapter.setStageOptions(PipelineStageIds.UnifiedIngestion, Object.freeze({
      outputTarget: "records",
    }));
    adapter.setStageOptions(PipelineStageIds.StoragePrepared, Object.freeze({
      destination: "prepared://warehouse/customers",
    }));
    const ready = adapter.assessExecutionReadiness();
    expect(ready.executionReady).toBeTrue();
    expect(ready.blockingIssues).toHaveLength(0);
  });
});
