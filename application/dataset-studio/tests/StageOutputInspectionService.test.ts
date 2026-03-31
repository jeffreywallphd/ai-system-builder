import { describe, expect, it } from "bun:test";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";
import { StageOutputInspectionService } from "../StageOutputInspectionService";

describe("StageOutputInspectionService", () => {
  it("normalizes stage inspection models across the full stage flow", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "json" }));
    engine.setStageOutput("source", Object.freeze({ sourceKind: "json", sourceReference: "memory://source" }));

    const service = new StageOutputInspectionService();
    const inspection = service.inspectFlow({
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
    });

    expect(Object.keys(inspection).length).toBe(engine.getStageFlow().stages.length);
    expect(inspection.source?.outputSource).toBe("concrete-output");
    expect(inspection.source?.contract.acceptedInputShapeKinds.length).toBeGreaterThan(0);
  });

  it("resolves output summary for normalized ingestion and raw storage references", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageOutput("ingestion", Object.freeze({
      detectedSourceKind: "json",
      outputTarget: "records",
      canonicalOutputKind: "records",
      status: "completed",
      warningCount: 0,
      errorCount: 0,
    }));
    engine.setStageOutput("raw-storage", Object.freeze({
      persistedAt: "2026-03-31T12:00:00.000Z",
      storageReference: "raw://storage/001",
      contentDigest: "digest-1",
      status: "completed",
    }));

    const service = new StageOutputInspectionService();
    const ingestion = service.inspectStageById({
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
    }, "ingestion");
    const rawStorage = service.inspectStageById({
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
    }, "raw-storage");

    expect(ingestion?.summary.title).toBe("Normalized ingestion output");
    expect(rawStorage?.summary.title).toBe("Raw storage reference output");
    expect(rawStorage?.outputSource).toBe("stored-reference");
  });

  it("returns structured fallback preview summary when no direct preview reference exists", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    engine.setStageOutput("source", Object.freeze({
      sourceKind: "csv",
      recordCount: 4,
    }));

    const service = new StageOutputInspectionService();
    const inspection = service.inspectStageById({
      stageFlow: engine.getStageFlow(),
      state: engine.getState(),
      stageRuntimeTracking: engine.getStageRuntimeTracking(),
    }, "source");

    expect(inspection?.preview.availability).toBe("unavailable");
    expect(inspection?.preview.fallbackSummary).toContain("Captured");
  });
});
