import { describe, expect, it } from "bun:test";
import { StageCanvasGraphProjectionService } from "../StageCanvasGraphProjectionService";
import { StagePipelinePersistenceService } from "../StagePipelinePersistenceService";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";

describe("StagePipelinePersistenceService", () => {
  it("round-trips wizard pipeline state through save/load and reconstructs graph/wizard state", () => {
    const template = new TemplateService().getTemplate("document-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "document" }));
    engine.goNext();
    engine.goNext();
    engine.setStageOutput("raw-storage", Object.freeze({
      persistedAt: "2026-03-31T12:00:00.000Z",
      storageReference: "raw://storage/002",
      status: "completed",
    }));

    const persistence = new StagePipelinePersistenceService();
    const document = persistence.saveFromWizard({ engine, pipelineId: "pipeline-1" });
    const serialized = persistence.serialize(document);
    const decoded = persistence.deserialize(serialized);
    const rehydrated = persistence.rehydrateWizardEngine(decoded);

    expect(decoded.pipeline.pipelineId).toBe("pipeline-1");
    expect(rehydrated.getState().currentStageId).toBe(engine.getState().currentStageId);
    expect(rehydrated.getState().stageConfiguration.source?.sourceKind).toBe("document");
    expect(rehydrated.getState().stageOutputs["raw-storage"]?.storageReference).toBe("raw://storage/002");

    const graph = new StageCanvasGraphProjectionService().projectFromWizard(rehydrated);
    expect(graph.metadata.stageCount).toBe(engine.getStageFlow().stages.length);
    expect(graph.metadata.currentStageId).toBe(engine.getState().currentStageId);
  });

  it("supports legacy persisted payload compatibility", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "json" }));

    const legacy = Object.freeze({
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
      navigationHistory: Object.freeze(["source"]),
    });

    const persistence = new StagePipelinePersistenceService();
    const decoded = persistence.decode(legacy);
    const rehydrated = persistence.rehydrateWizardEngine(decoded);

    expect(decoded.version).toBe("1.0.0");
    expect(rehydrated.getState().stageConfiguration.source?.sourceKind).toBe("json");
    expect(rehydrated.getNavigationHistory()).toEqual(["source"]);
  });

  it("rejects unsupported persistence versions", () => {
    const persistence = new StagePipelinePersistenceService();
    expect(() => persistence.decode(Object.freeze({
      kind: "dataset-stage-pipeline",
      version: "2.0.0",
      persistedAt: "2026-03-31T12:00:00.000Z",
      pipeline: Object.freeze({
        pipelineId: "pipeline-x",
        flowId: "pipeline-x",
        name: "Pipeline X",
      }),
      stageFlow: Object.freeze({}),
      runtimeState: Object.freeze({}),
      stageRuntimeTracking: Object.freeze({}),
      wizard: Object.freeze({ navigationHistory: Object.freeze([]) }),
      stageAssetMappings: Object.freeze({}),
      graph: Object.freeze({
        nodeCount: 0,
        edgeCount: 0,
        stageCount: 1,
      }),
    }))).toThrow("Unsupported persisted stage pipeline version");
  });
});
