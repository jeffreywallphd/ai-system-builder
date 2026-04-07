import { describe, expect, it } from "bun:test";
import { PipelineStageIds } from "../../../domain/dataset-studio/PipelineStageDomain";
import { PipelineEditingService } from "../PipelineEditingService";
import { MidLevelPipelineTemplateService } from "../MidLevelPipelineTemplateService";

describe("MidLevelPipelineTemplateService", () => {
  it("registers the default mid-level template set", () => {
    const service = new MidLevelPipelineTemplateService();
    const templates = service.listTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "general-data-preparation",
      "analytics-preparation",
      "document-preparation",
      "image-preparation",
    ]);
  });

  it("instantiates templates into deterministic editable pipeline + graph outputs", () => {
    const service = new MidLevelPipelineTemplateService();
    const result = service.instantiate("general-data-preparation", {
      enabledOptionalStageIds: Object.freeze([PipelineStageIds.FeatureEngineering]),
      stageConfigOverrides: Object.freeze({
        [PipelineStageIds.Cleaning]: Object.freeze({
          missingStrategy: "fill-default",
        }),
      }),
    });

    expect(result.pipelineDefinition.stageInstances.length).toBeGreaterThanOrEqual(3);
    expect(result.pipelineGraph.nodes.length).toBeGreaterThan(0);
    expect(result.reactFlowGraph.nodes.length).toBe(result.pipelineGraph.nodes.length);
    expect(
      result.pipelineDefinition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.FeatureEngineering)
        ?.enabled,
    ).toBeTrue();
    expect(
      result.pipelineDefinition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.Cleaning)
        ?.config.options.missingStrategy,
    ).toBe("fill-default");

    const editingService = new PipelineEditingService();
    const edited = editingService.removeStage(result.pipelineDefinition, PipelineStageIds.FeatureEngineering);
    expect(edited.definition.stageInstances.some((stage) => stage.stageId === PipelineStageIds.FeatureEngineering))
      .toBeFalse();
  });

  it("fails fast on invalid template stage-order override", () => {
    const service = new MidLevelPipelineTemplateService();
    expect(() => service.instantiate("document-preparation", {
      stageOrder: Object.freeze([
        PipelineStageIds.Labeling,
        PipelineStageIds.Chunking,
      ]),
    })).toThrow("missing required stage");
  });
});
