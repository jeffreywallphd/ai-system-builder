import { describe, expect, it } from "bun:test";
import { DatasetPipelineStageKinds } from "../../domain/dataset-studio/StagePipelineDomain";
import { UnifiedIngestionOutputTargetKinds } from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { StageAssetMappingService } from "../StageAssetMappingService";

describe("StageAssetMappingService", () => {
  it("resolves static stage mappings for source selection", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.sourceSelection,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("unified-ingestion");
    }
  });

  it("resolves static stage mappings for template-only stage kinds", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.preparedStorage,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("unified-ingestion");
    }
  });

  it("resolves profiling stage to the data profiling transformation asset", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.profiling,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("data-profiling");
      expect(result.assets[0]?.configDefaults?.sampleSize).toBe(500);
    }
  });

  it("resolves transformation stage to the field mapping asset", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.transformation,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("field-mapping");
      expect(result.assets[0]?.configDefaults?.preserveUnmapped).toBeTrue();
    }
  });

  it("resolves raw-storage stage to storage asset defaults and metadata hooks", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.rawStorage,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("raw-storage-stage");
      expect(result.assets[0]?.configDefaults?.persistRawPayload).toBeTrue();
      expect(result.assets[0]?.metadataHooks?.traceabilityHook).toBe("ingestion-lineage");
    }
  });

  it("resolves conditional ingestion mappings by detected source kind", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.ingestion,
      detectedSourceKind: "json",
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("json-ingestor");
      expect(result.policy).toBe("detected-kind");
      expect(result.fallbackUsed).toBeFalse();
    }
  });

  it("resolves conditional ingestion mappings by advanced strategy override", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.ingestion,
      detectedSourceKind: "unknown",
      strategy: "document",
      outputTarget: UnifiedIngestionOutputTargetKinds.records,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("document-pdf-ingestor");
      expect(result.policy).toBe("advanced-strategy");
      expect(result.fallbackUsed).toBeFalse();
    }
  });

  it("resolves deterministic output-target fallback mappings for unknown sources", () => {
    const service = new StageAssetMappingService();
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.ingestion,
      detectedSourceKind: "unknown",
      outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
    });

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.assets[0]?.assetId).toBe("document-pdf-ingestor");
      expect(result.policy).toBe("output-target-fallback");
      expect(result.fallbackUsed).toBeTrue();
    }
  });

  it("returns unsupported for unknown stage mappings", () => {
    const service = new StageAssetMappingService(Object.freeze([]));
    const result = service.resolveStage({
      stageKind: DatasetPipelineStageKinds.ingestion,
      detectedSourceKind: "json",
    });

    expect(result.status).toBe("unsupported");
    if (result.status === "unsupported") {
      expect(result.failureCode).toBe("missing-route-mapping");
    }
  });
});
