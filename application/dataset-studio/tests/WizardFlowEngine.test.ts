import { describe, expect, it } from "bun:test";
import { IntentService } from "../IntentService";
import { StageExecutionPolicy } from "../StageExecutionPolicy";
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

  it("initializes flow using intent resolution and tracks intent context", () => {
    const templates = new TemplateService();
    const intents = new IntentService(templates);
    const engine = new WizardFlowEngine({
      intentId: "ml",
      intentService: intents,
      stageExecutionPolicy: new StageExecutionPolicy(),
    });

    expect(engine.getIntentContext()?.id).toBe("ml");
    expect(engine.getStageFlow().stages.some((stage) => stage.kind === "feature-engineering")).toBeTrue();
    expect(engine.getState().autoConfiguredStageIds).toContain("normalization");
  });

  it("tracks skipped, auto-configured, and user-overridden stages", () => {
    const templates = new TemplateService();
    const intents = new IntentService(templates);
    const template = templates.getTemplate("document-default");
    const engine = new WizardFlowEngine({
      template,
      intentId: "document",
      intentService: intents,
      stageExecutionPolicy: new StageExecutionPolicy(),
    });

    engine.setStageConfiguration("chunking", Object.freeze({ chunkSize: 800, chunkOverlap: 100 }));
    engine.goNext();
    engine.setStageOutput("ingestion", Object.freeze({ detectedSourceKind: "json" }));
    const move = engine.goNext();

    expect(move.transition?.skippedStageIds).toContain("extraction");
    expect(engine.getState().skippedStageIds).toContain("extraction");
    expect(engine.getState().autoConfiguredStageIds).toContain("chunking");
    expect(engine.getState().userOverriddenStageIds).toContain("chunking");
  });
});
