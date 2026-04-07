import { describe, expect, it } from "bun:test";
import {
  buildPreparedDatasetLineage,
  buildPreparedDatasetReuseReference,
  InMemoryPreparedDatasetReuseCatalog,
  validatePreparedDatasetLineageLinks,
} from "../DataStudioLineageAndReuseService";
import { createDefaultDataStudioPreparationAssetDefinition } from "../DataStudioPreparationAssetDefaults";
import { PipelineStageIds } from "@domain/dataset-studio/PipelineStageDomain";
import { DataStudioAuthoringModes } from "../DataStudioPipelineState";

describe("DataStudioLineageAndReuseService", () => {
  const stages = Object.freeze([
    Object.freeze({
      stageId: PipelineStageIds.SourceSelection,
      order: 1,
      enabled: true,
      status: "completed" as const,
      visibility: "simple" as const,
      configMode: "simple" as const,
      activation: Object.freeze({ mode: "always" as const }),
      options: Object.freeze({ sourceReference: "in-memory://records", sourceKind: "json" }),
      assetGroupIds: Object.freeze(["source"]),
    }),
    Object.freeze({
      stageId: PipelineStageIds.UnifiedIngestion,
      order: 2,
      enabled: true,
      status: "current" as const,
      visibility: "simple" as const,
      configMode: "simple" as const,
      activation: Object.freeze({ mode: "always" as const }),
      options: Object.freeze({}),
      assetGroupIds: Object.freeze(["ingestion"]),
    }),
    Object.freeze({
      stageId: PipelineStageIds.StoragePrepared,
      order: 3,
      enabled: true,
      status: "pending" as const,
      visibility: "simple" as const,
      configMode: "simple" as const,
      activation: Object.freeze({ mode: "always" as const }),
      options: Object.freeze({ destination: "prepared://dataset" }),
      assetGroupIds: Object.freeze(["storage-prepared"]),
    }),
  ]);

  it("builds structured lineage and reusable prepared dataset references", () => {
    const asset = createDefaultDataStudioPreparationAssetDefinition();
    const lineage = buildPreparedDatasetLineage({
      identity: Object.freeze({
        draftId: "draft-1",
        pipelineId: "pipeline-1",
        assetId: "data-studio.pipeline.v1",
        assetVersionId: "1.0.0",
        name: "Prepared Dataset Pipeline",
        revision: 2,
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:10:00.000Z",
      }),
      asset,
      stages,
      transitions: Object.freeze([
        Object.freeze({ fromStageId: PipelineStageIds.SourceSelection, toStageId: PipelineStageIds.UnifiedIngestion }),
        Object.freeze({ fromStageId: PipelineStageIds.UnifiedIngestion, toStageId: PipelineStageIds.StoragePrepared }),
      ]),
      flow: Object.freeze({
        authoringMode: DataStudioAuthoringModes.wizard,
        currentStageId: PipelineStageIds.UnifiedIngestion,
        presentationMode: "simple",
        progressiveDisclosureMode: "simple",
        templateId: "elt-pipeline",
        completedStageIds: Object.freeze([PipelineStageIds.SourceSelection]),
        skippedStageIds: Object.freeze([]),
        navigationHistory: Object.freeze([PipelineStageIds.SourceSelection]),
      }),
      templateIntent: "elt",
      preparedStorageReference: "prepared://dataset/output",
    });

    expect(lineage.upstream.sources.length).toBeGreaterThan(0);
    expect(lineage.stages.length).toBe(3);
    expect(lineage.output.preparedAssetId).toBe(asset.output.preparedAssetId);
    expect(lineage.preparationContext.currentStageId).toBe(PipelineStageIds.UnifiedIngestion);

    const reuse = buildPreparedDatasetReuseReference(lineage);
    expect(reuse.assetId).toBe(asset.output.preparedAssetId);
    expect(reuse.discoverability.semanticRole).toBe("dataset");
    expect(reuse.discoverability.sourceType).toBe("data-studio");
  });

  it("flags invalid lineage links and supports discovery resolution from reuse catalog", () => {
    const asset = createDefaultDataStudioPreparationAssetDefinition();
    const lineage = buildPreparedDatasetLineage({
      identity: Object.freeze({
        draftId: "draft-1",
        pipelineId: "pipeline-1",
        assetId: "data-studio.pipeline.v1",
        assetVersionId: "1.0.0",
        name: "Prepared Dataset Pipeline",
        revision: 1,
        createdAt: "2026-03-31T10:00:00.000Z",
        updatedAt: "2026-03-31T10:10:00.000Z",
      }),
      asset,
      stages,
      transitions: Object.freeze([
        Object.freeze({ fromStageId: PipelineStageIds.SourceSelection, toStageId: PipelineStageIds.UnifiedIngestion }),
        Object.freeze({ fromStageId: PipelineStageIds.UnifiedIngestion, toStageId: PipelineStageIds.StoragePrepared }),
      ]),
      flow: Object.freeze({
        authoringMode: DataStudioAuthoringModes.canvas,
        currentStageId: PipelineStageIds.StoragePrepared,
        presentationMode: "advanced",
        progressiveDisclosureMode: "advanced",
        templateId: "analytics-pipeline",
        completedStageIds: Object.freeze([PipelineStageIds.SourceSelection, PipelineStageIds.UnifiedIngestion]),
        skippedStageIds: Object.freeze([]),
        navigationHistory: Object.freeze([PipelineStageIds.SourceSelection, PipelineStageIds.UnifiedIngestion]),
      }),
      templateIntent: "analytics",
    });

    const invalid = Object.freeze({
      ...lineage,
      stages: Object.freeze(lineage.stages.filter((stage) => stage.stageId !== PipelineStageIds.StoragePrepared)),
    });

    const issues = validatePreparedDatasetLineageLinks(invalid);
    expect(issues.some((issue) => issue.code === "lineage.stage.prepared-storage.missing")).toBeTrue();

    const catalog = new InMemoryPreparedDatasetReuseCatalog();
    const reuse = buildPreparedDatasetReuseReference(lineage, {
      displayName: "Prepared Customer Dataset",
      additionalTags: Object.freeze(["customer"]),
    });
    catalog.register(reuse);
    expect(catalog.resolve(reuse.assetId)?.displayName).toBe("Prepared Customer Dataset");
    expect(catalog.list().length).toBe(1);
  });
});

