import { describe, expect, it } from "bun:test";
import { TemplateService } from "../TemplateService";
import {
  StageExecutionDispositions,
  StageExecutionPolicy,
} from "../StageExecutionPolicy";
import { createInitialStageFlowRuntimeState, withStageOutput } from "../../../domain/dataset-studio/StageFlowDefinition";

describe("StageExecutionPolicy", () => {
  it("skips extraction when ingestion output is already structured", () => {
    const template = new TemplateService().getTemplate("document-default");
    const extraction = template.stageFlow.stages.find((stage) => stage.id === "extraction");
    if (!extraction) {
      throw new Error("expected extraction stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      Object.freeze({ detectedSourceKind: "csv" }),
    );

    const decision = policy.evaluate({
      stage: extraction,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.skip);
  });

  it("auto-configures normalization when schema is known", () => {
    const template = new TemplateService().getTemplate("elt-default");
    const normalization = template.stageFlow.stages.find((stage) => stage.id === "normalization");
    if (!normalization) {
      throw new Error("expected normalization stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "ingestion",
      Object.freeze({ schemaKnown: true }),
    );

    const decision = policy.evaluate({
      stage: normalization,
      stageFlow: template.stageFlow,
      state,
      templateDefaults: template.defaultStageConfiguration,
      intentDefaults: Object.freeze({
        normalization: Object.freeze({ strategy: "contract-first" }),
      }),
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.execute);
    expect(decision.autoConfiguration.schemaMode).toBe("known");
    expect(decision.autoConfiguration.useDetectedSchema).toBeTrue();
    expect(decision.autoConfiguration.strategy).toBe("contract-first");
  });

  it("auto-completes stages that already have completed outputs", () => {
    const template = new TemplateService().getTemplate("analytics-default");
    const profiling = template.stageFlow.stages.find((stage) => stage.id === "profiling");
    if (!profiling) {
      throw new Error("expected profiling stage");
    }

    const policy = new StageExecutionPolicy();
    const state = withStageOutput(
      createInitialStageFlowRuntimeState(template.stageFlow),
      "profiling",
      Object.freeze({ completed: true }),
    );

    const decision = policy.evaluate({
      stage: profiling,
      stageFlow: template.stageFlow,
      state,
    });

    expect(decision.disposition).toBe(StageExecutionDispositions.autoComplete);
  });
});
