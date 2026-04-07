import { describe, expect, it } from "bun:test";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import { DataStudioPreparationTemplateRegistry } from "../DataStudioPreparationTemplates";

describe("DataStudioPreparationTemplateRegistry", () => {
  it("registers built-in intent templates", () => {
    const registry = new DataStudioPreparationTemplateRegistry();
    const templates = registry.listTemplates();

    expect(templates.map((template) => template.id)).toEqual([
      "elt-pipeline",
      "analytics-pipeline",
      "document-pipeline",
      "image-pipeline",
    ]);
    expect(registry.getDefaultTemplateId()).toBe("elt-pipeline");
  });

  it("instantiates templates into valid unified-preparation assets", () => {
    const registry = new DataStudioPreparationTemplateRegistry();
    const analytics = registry.instantiate("analytics-pipeline");

    expect(analytics.asset.identity.assetId).toBe("data-studio.preparation.analytics-pipeline");
    expect(analytics.asset.upstreamBindings[0]?.pipelineAssetId).toBe("pipeline.tabular-cleaning.v1");
    expect(analytics.asset.stages.find((stage) => stage.stageId === PipelineStageIds.Aggregation)?.activation.mode).toBe("always");
    expect(analytics.asset.stages.find((stage) => stage.stageId === PipelineStageIds.StoragePrepared)?.options.destination)
      .toBe("prepared://analytics");
  });

  it("exposes inspectable field descriptors and template visibility overrides", () => {
    const registry = new DataStudioPreparationTemplateRegistry();
    const descriptors = registry.listFieldDescriptors();

    expect(descriptors.some((field) => field.fieldId === "source-kind")).toBeTrue();
    expect(
      registry.resolveFieldVisibilityOverride("document-pipeline", PipelineStageIds.SourceSelection, "enable-labeling"),
    ).toBeUndefined();
  });
});

