import { describe, expect, it } from "bun:test";
import { StageCanvasEditingService } from "../StageCanvasEditingService";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";

describe("StageCanvasEditingService", () => {
  it("updates stage configuration and regenerates graph", () => {
    const templateService = new TemplateService();
    const template = templateService.getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    const service = new StageCanvasEditingService({ templateService });

    const result = service.updateStageConfiguration(
      engine,
      "source",
      Object.freeze({ sourceKind: "csv", sourceReference: "memory://sample" }),
    );

    expect(result.ok).toBeTrue();
    expect(engine.getState().stageConfiguration.source?.sourceKind).toBe("csv");
    expect(result.graph?.groups.find((group) => group.stageId === "source")?.metadata.configuration.sourceKind).toBe("csv");
  });

  it("prevents required stage removal and allows optional stage removal", () => {
    const templateService = new TemplateService();
    const template = templateService.getTemplate("document-default");
    const engine = new WizardFlowEngine({ template });
    const service = new StageCanvasEditingService({ templateService });

    const requiredResult = service.removeOptionalStage(engine, "source");
    expect(requiredResult.ok).toBeFalse();
    expect(requiredResult.issues[0]?.code).toBe("stage-remove-required-forbidden");

    const optionalResult = service.removeOptionalStage(engine, "extraction");
    expect(optionalResult.ok).toBeTrue();
    expect(engine.getStageFlow().stages.some((stage) => stage.id === "extraction")).toBeFalse();
  });

  it("rejects invalid reorder and accepts valid optional-stage reorder", () => {
    const templateService = new TemplateService();
    const template = templateService.getTemplate("document-default");
    const engine = new WizardFlowEngine({ template });
    const service = new StageCanvasEditingService({ templateService });

    const invalid = service.reorderStages(
      engine,
      Object.freeze([
        "ingestion",
        "source",
        ...engine.getStageFlow().stages.filter((stage) => !["source", "ingestion"].includes(stage.id)).map((stage) => stage.id),
      ]),
    );

    expect(invalid.ok).toBeFalse();
    expect(invalid.issues[0]?.code).toBe("stage-reorder-required-order-violation");

    const currentOrder = engine.getStageFlow().stages.map((stage) => stage.id);
    const extractionIndex = currentOrder.indexOf("extraction");
    const chunkingIndex = currentOrder.indexOf("chunking");
    const nextOrder = [...currentOrder];
    [nextOrder[extractionIndex], nextOrder[chunkingIndex]] = [nextOrder[chunkingIndex], nextOrder[extractionIndex]];

    const valid = service.reorderStages(engine, Object.freeze(nextOrder));
    expect(valid.ok).toBeTrue();
    expect(engine.getStageFlow().stages.map((stage) => stage.id)).toEqual(nextOrder);
  });

  it("adds optional stages where valid", () => {
    const templateService = new TemplateService();
    const template = templateService.getTemplate("elt-default");
    const engine = new WizardFlowEngine({ template });
    const service = new StageCanvasEditingService({ templateService });

    const addableBefore = service.listAddableOptionalStages(engine);
    expect(addableBefore.length).toBeGreaterThan(0);

    const result = service.addOptionalStage(engine, addableBefore[0]!.kind);
    expect(result.ok).toBeTrue();
    expect(result.graph?.metadata.stageCount).toBe(engine.getStageFlow().stages.length);

    const duplicate = service.addOptionalStage(engine, addableBefore[0]!.kind);
    expect(duplicate.ok).toBeFalse();
    expect(duplicate.issues[0]?.code).toBe("stage-insert-duplicate-kind");
  });
});
