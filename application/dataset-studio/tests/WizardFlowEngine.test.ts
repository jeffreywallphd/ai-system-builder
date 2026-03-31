import { describe, expect, it } from "bun:test";
import { TemplateService } from "../TemplateService";
import { WizardFlowEngine } from "../WizardFlowEngine";

describe("WizardFlowEngine", () => {
  it("navigates forward/backward through stage flow state", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("elt-default");
    const engine = new WizardFlowEngine({
      template,
    });

    const firstMove = engine.goNext();
    expect(firstMove.moved).toBeTrue();
    expect(engine.getState().currentStageId).toBe("ingestion");

    const secondMove = engine.goBack();
    expect(secondMove.moved).toBeTrue();
    expect(engine.getState().currentStageId).toBe("source");
  });

  it("supports conditional branching based on stage outputs", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      stageFlow: {
        ...template.stageFlow,
        conditionalTransitions: Object.freeze([
          Object.freeze({
            id: "skip-to-prepared",
            fromStageId: "ingestion",
            toStageId: "prepared-storage",
            conditionId: "skip-document-transform",
            priority: 1,
          }),
        ]),
      },
      conditionEvaluators: Object.freeze({
        "skip-document-transform": (context) => context.stageOutputs.ingestion?.sourceKind === "image",
      }),
    });

    engine.goNext();
    engine.setStageOutput("ingestion", Object.freeze({ sourceKind: "image" }));
    const move = engine.goNext();

    expect(move.moved).toBeTrue();
    expect(move.transition?.toStageId).toBe("prepared-storage");
    expect(move.transition?.skippedStageIds).toEqual([
      "extraction",
      "chunking",
      "transformation",
    ]);
  });

  it("auto-skips conditional stages when condition criteria are not met", () => {
    const templates = new TemplateService();
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      template,
      conditionEvaluators: Object.freeze({
        "requires-extraction": (context) => context.stageConfiguration.source?.sourceKind === "document",
      }),
    });

    engine.setStageConfiguration("source", Object.freeze({ sourceKind: "json" }));
    engine.goNext();
    const move = engine.goNext();

    expect(move.moved).toBeTrue();
    expect(move.transition?.toStageId).toBe("chunking");
    expect(move.transition?.skippedStageIds).toContain("extraction");
  });
});
