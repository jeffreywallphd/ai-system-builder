import { describe, expect, it } from "bun:test";
import { CanonicalDataShapeKinds } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  PipelineStageConfigModes,
  PipelineStageIds,
} from "../../domain/dataset-studio/PipelineStageDomain";
import { PipelineStageRegistry } from "../../domain/dataset-studio/PipelineStageRegistry";
import { StageAssetCompositionService } from "../StageAssetCompositionService";

describe("StageAssetCompositionService", () => {
  it("maps normalization stage to a single normalizer asset", () => {
    const registry = new PipelineStageRegistry();
    const service = new StageAssetCompositionService();

    const resolved = service.resolve({
      stage: registry.getDefinition(PipelineStageIds.Normalization),
      config: {
        mode: PipelineStageConfigModes.simple,
        declaredInputType: CanonicalDataShapeKinds.records,
        options: Object.freeze({ trimStrings: true }),
      },
    });

    expect(resolved.groups).toHaveLength(1);
    expect(resolved.groups[0]?.assets).toHaveLength(1);
    expect(resolved.groups[0]?.assets[0]?.assetId).toBe("type-normalization");
  });

  it("maps cleaning stage to ordered multi-asset composition", () => {
    const registry = new PipelineStageRegistry();
    const service = new StageAssetCompositionService();

    const resolved = service.resolve({
      stage: registry.getDefinition(PipelineStageIds.Cleaning),
      config: {
        mode: PipelineStageConfigModes.advanced,
        declaredInputType: CanonicalDataShapeKinds.records,
        options: Object.freeze({
          missingStrategy: "fill-default",
          dedupeMode: "exact-all",
        }),
      },
    });

    expect(resolved.groups[0]?.assets.map((asset) => asset.assetId)).toEqual([
      "missing-value-handling",
      "deduplication",
    ]);
    expect(resolved.groups[0]?.executionMode).toBe("sequential");
  });

  it("supports conditional composition for unified ingestion", () => {
    const registry = new PipelineStageRegistry();
    const service = new StageAssetCompositionService();

    const resolved = service.resolve({
      stage: registry.getDefinition(PipelineStageIds.UnifiedIngestion),
      config: {
        mode: PipelineStageConfigModes.advanced,
        declaredInputType: CanonicalDataShapeKinds.records,
        options: Object.freeze({ strategy: "json", outputTarget: "records" }),
      },
    });

    expect(resolved.groups[0]?.assets.some((asset) => asset.assetId === "json-ingestor")).toBeTrue();
    expect(resolved.groups[0]?.assets.some((asset) => asset.assetId === "unified-ingestion")).toBeTrue();
  });

  it("projects resolved composition to a React Flow compatible graph segment", () => {
    const registry = new PipelineStageRegistry();
    const service = new StageAssetCompositionService();

    const resolved = service.resolve({
      stage: registry.getDefinition(PipelineStageIds.Transformation),
      config: {
        mode: PipelineStageConfigModes.simple,
        declaredInputType: CanonicalDataShapeKinds.records,
        options: Object.freeze({}),
      },
    });

    const segment = service.toAssetGraphSegment({
      stageId: PipelineStageIds.Transformation,
      composition: resolved,
      previousNodeIds: Object.freeze(["upstream:node:1"]),
      idPrefix: "pipeline:segment:transformation",
    });

    expect(segment.nodes.length).toBeGreaterThan(0);
    expect(segment.edges.length).toBeGreaterThan(0);
    expect(segment.edges.some((edge) => edge.data?.kind === "upstream-bridge")).toBeTrue();
    expect(segment.orderedNodeIds[0]?.startsWith("pipeline:segment:transformation")).toBeTrue();
  });
});