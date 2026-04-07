import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../../../domain/dataset-studio/CanonicalDataShapes";
import { PipelineStageIds } from "../../../domain/dataset-studio/PipelineStageDomain";
import { UnifiedPreparationAssetKinds } from "../../../domain/dataset-studio/UnifiedPreparationAsset";
import { UnifiedPreparationPipelineService } from "../UnifiedPreparationPipelineService";

function createDefinition() {
  return Object.freeze({
    identity: Object.freeze({
      assetId: "prep.asset.v1",
      versionId: "1.0.0",
      kind: UnifiedPreparationAssetKinds.unifiedPreparation,
    }),
    versioning: Object.freeze({
      schemaVersion: "1.0.0",
      contractVersion: "1.0.0",
      revision: 1,
    }),
    upstreamBindings: Object.freeze([
      Object.freeze({
        pipelineAssetId: "pipeline.tabular-cleaning.v1",
      }),
    ]),
    stages: Object.freeze([
      Object.freeze({
        stageId: PipelineStageIds.SourceSelection,
        visibility: "simple",
        configMode: "simple",
        activation: Object.freeze({ mode: "always" }),
        options: Object.freeze({}),
      }),
      Object.freeze({
        stageId: PipelineStageIds.UnifiedIngestion,
        visibility: "simple",
        configMode: "advanced",
        activation: Object.freeze({ mode: "always" }),
        options: Object.freeze({ strategy: "auto" }),
      }),
      Object.freeze({
        stageId: PipelineStageIds.Normalization,
        visibility: "simple",
        configMode: "advanced",
        activation: Object.freeze({ mode: "always" }),
        options: Object.freeze({ trimStrings: true }),
      }),
      Object.freeze({
        stageId: PipelineStageIds.Cleaning,
        visibility: "advanced",
        configMode: "advanced",
        activation: Object.freeze({ mode: "always" }),
        options: Object.freeze({ dedupeMode: "exact-all" }),
      }),
      Object.freeze({
        stageId: PipelineStageIds.StoragePrepared,
        visibility: "simple",
        configMode: "simple",
        activation: Object.freeze({ mode: "always" }),
        options: Object.freeze({ destination: "prepared://dataset" }),
      }),
    ]),
    output: Object.freeze({
      preparedAssetId: "prepared.dataset.v1",
      outputShapeKind: CanonicalDataShapeKinds.records,
    }),
    lineage: Object.freeze({
      upstreamAssetIds: Object.freeze(["pipeline.tabular-cleaning.v1"]),
      reusableAsAsset: true,
    }),
    preview: Object.freeze({
      previewEnabled: true,
      inspectionEnabled: true,
      previewSampleSize: 50,
    }),
  });
}

describe("UnifiedPreparationPipelineService", () => {
  it("resolves unified preparation stages into pipeline and graph projections", () => {
    const service = new UnifiedPreparationPipelineService();
    const resolution = service.resolve(createDefinition());

    expect(resolution.pipelineDefinition.stageInstances.length).toBe(5);
    expect(resolution.graph.nodes.some((node) => node.id === "stage:Normalization")).toBeTrue();
    expect(resolution.stageGroupMappings.some((mapping) => mapping.stageId === PipelineStageIds.Cleaning)).toBeTrue();
    expect(resolution.authoringGraph.groups.length).toBeGreaterThan(0);
  });

  it("supports optional stage disablement and excludes disabled stage from graph", () => {
    const service = new UnifiedPreparationPipelineService();
    const definition = createDefinition();
    const withDisabledOptional = Object.freeze({
      ...definition,
      stages: Object.freeze([
        ...definition.stages,
        Object.freeze({
          stageId: PipelineStageIds.Classification,
          visibility: "advanced",
          configMode: "simple",
          activation: Object.freeze({ mode: "disabled" }),
          options: Object.freeze({}),
        }),
      ]),
    });

    const resolution = service.resolve(withDisabledOptional);
    expect(
      resolution.pipelineDefinition.stageInstances.find((stage) => stage.stageId === PipelineStageIds.Classification)?.enabled,
    ).toBeFalse();
    expect(resolution.graph.nodes.some((node) => node.id === "stage:Classification")).toBeFalse();
  });

  it("rejects non-epic17 upstream pipeline bindings", () => {
    const service = new UnifiedPreparationPipelineService();
    const definition = createDefinition();
    const invalidBindingDefinition = Object.freeze({
      ...definition,
      upstreamBindings: Object.freeze([
        Object.freeze({
          pipelineAssetId: "pipeline.custom.v9",
        }),
      ]),
    });

    expect(() => service.resolve(invalidBindingDefinition)).toThrow(
      "is not an Epic 17 pipeline reference",
    );
  });
});

