import { describe, expect, it } from "bun:test";
import { DataStudioPreparationWizard } from "../DataStudioPreparationWizard";
import { DataStudioWizardCanvasProjectionService } from "../DataStudioWizardCanvasProjectionService";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";

describe("DataStudioWizardCanvasProjectionService", () => {
  it("projects wizard snapshots into canvas graph metadata without rebuilding a separate graph model", () => {
    const wizard = new DataStudioPreparationWizard();
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
    }));
    wizard.goNext();
    const snapshot = wizard.getSnapshot();
    const service = new DataStudioWizardCanvasProjectionService();
    const projection = service.projectFromWizardSnapshot(snapshot);

    expect(projection.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);
    expect(projection.graph.source).toBe("canvas");
    expect(projection.graph.nodes.length).toBe(snapshot.authoringGraph.nodes.length);
    expect(projection.graph.edges.length).toBe(snapshot.authoringGraph.edges.length);

    const sourceStageNode = projection.graph.nodes.find((node) => node.metadata?.stageId === PipelineStageIds.SourceSelection);
    expect(sourceStageNode?.metadata?.stageStatus).toBe("completed");
  });

  it("projects handoff payloads while preserving stage status and availability semantics", () => {
    const wizard = new DataStudioPreparationWizard();
    wizard.setStageOptions(PipelineStageIds.SourceSelection, Object.freeze({
      sourceReference: "in-memory://records",
      sourceKind: "json",
      enableLabeling: true,
    }));
    wizard.goNext();
    wizard.goNext();

    const handoff = wizard.toCanvasHandoff();
    const service = new DataStudioWizardCanvasProjectionService();
    const projection = service.projectFromCanvasHandoff(handoff);

    expect(projection.stageSummaries.length).toBe(handoff.stages.length);
    expect(projection.stageSummaries.some((stage) => stage.status === "current")).toBeTrue();

    const currentStage = projection.stageSummaries.find((stage) => stage.stageId === handoff.currentStageId);
    expect(currentStage?.isAvailable).toBeTrue();
  });
});

