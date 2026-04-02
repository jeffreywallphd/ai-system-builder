import { describe, expect, it } from "bun:test";
import { InMemoryDatasetInstanceRepository } from "../../system-runtime/DatasetInstanceRepository";
import { SystemDatasetInstanceService, type SystemDatasetOwnershipValidator } from "../../system-runtime/SystemDatasetInstanceService";
import type { DatasetInstanceAssetCatalog } from "../../system-runtime/DatasetInstanceAssetCatalog";
import { DatasetSchemaIntentIds, type DatasetSchemaIntentId } from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { DefaultWorkflowRuntimeOutputPersistenceService } from "../WorkflowRuntimeOutputPersistenceService";
import type { IWorkflowExecutionInput, IWorkflowExecutionResult } from "../../ports/interfaces/IWorkflowExecutor";
import { createImageWorkflowOutputBindingConfiguration } from "../../contracts/ImageWorkflowOutputBindingConfiguration";
import { OutputGalleryDatasetIntegrationService } from "../../system-runtime/OutputGalleryDatasetIntegrationService";
import { ImageRunHistoryService } from "../../system-runtime/ImageRunHistoryService";
import {
  InMemoryImageRunHistoryRepository,
} from "../../system-runtime/ImageRunHistoryRepository";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string }) {
    if (!input.assetId.startsWith("asset:dataset:")) {
      return undefined;
    }
    return Object.freeze({
      assetId: input.assetId,
      versionId: input.versionId ?? "v1",
      schemaIntentId: DatasetSchemaIntentIds.media as DatasetSchemaIntentId,
      outputShapeKind: "image-metadata-records" as const,
    });
  }
}

class AllowAnySystem implements SystemDatasetOwnershipValidator {
  public assertSystemExists(): void {}
}

function createExecutionInput(): IWorkflowExecutionInput {
  return {
    workflow: {
      id: "asset:workflow:image",
      metadata: { name: "Image workflow", version: "v7" },
      status: "ready",
      isEnabled: true,
      executionPolicy: "acyclic-only",
      nodes: [],
      connections: [],
      getNode: () => undefined,
      getConnection: () => undefined,
      getGraph: () => ({}) as never,
      validate: () => ({ isValid: true, messages: [], invalidNodeIds: [], invalidConnectionIds: [] }),
      toJSON: () => ({}),
    },
    executionMetadata: {
      imageStudioHandoff: {
        handoffId: "handoff:image:5.2.4",
        sourceStudioType: "data-studio",
        sourceStudioId: "studio:data",
        targetStudioType: "workflow-studio",
        targetStudioId: "studio:workflow",
        primaryAsset: { assetId: "asset:image:input", versionId: "asset:image:input:v1" },
        referencedAssets: [],
        datasetInstances: [],
        workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v7" }, bindingId: "binding:workflow:image" },
        systemBinding: {
          system: { assetId: "system:image", versionId: "system:image:v1" },
          workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v7" }, bindingId: "binding:workflow:image" },
          datasets: [],
        },
        runtimeInput: {
          context: { selectedImages: [], parameters: {}, datasets: [], runtime: {} },
          workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v7" }, bindingId: "binding:workflow:image" },
          systemBinding: {
            system: { assetId: "system:image", versionId: "system:image:v1" },
            workflow: { workflow: { assetId: "asset:workflow:image", versionId: "asset:workflow:image:v7" }, bindingId: "binding:workflow:image" },
            datasets: [],
          },
          trace: {
            handoffId: "handoff:image:5.2.4",
            traceId: "trace:image:5.2.4",
            sourceStudioType: "data-studio",
            sourceStudioId: "studio:data",
          },
        },
        events: [],
        persistedRelationships: [],
      },
      workflowOutputPersistence: {
        systemId: "system:image",
        configuration: createImageWorkflowOutputBindingConfiguration({
          bindings: [
            { bindingId: "b.out", outputId: "images", targetType: "output-dataset", targetId: "target:out", datasetInstanceId: "instance:out" },
            { bindingId: "b.history", outputId: "images", targetType: "history-dataset", targetId: "target:hist", datasetInstanceId: "instance:hist", writeMode: "append" },
            { bindingId: "b.compare", outputId: "images", targetType: "comparison-dataset", targetId: "target:cmp", datasetInstanceId: "instance:cmp", groupBy: "set:abc", writeMode: "append" },
          ],
        }),
      },
    },
  };
}

function createExecutionResult(): IWorkflowExecutionResult {
  return {
    executionId: "exec:1",
    status: "completed",
    outputAssets: [
      {
        id: "asset:out:1",
        kind: "image",
        name: "out.png",
        status: "available",
        source: { type: "generated" },
        location: { accessMethod: "remote-url", location: "https://example.com/out.png", format: "png", contentType: "image/png" },
        technicalMetadata: { width: 128, height: 128 },
        semanticMetadata: { tags: ["generated"] },
        relationships: [],
      } as never,
    ],
  };
}

describe("DefaultWorkflowRuntimeOutputPersistenceService", () => {
  it("persists output/history/comparison records through one runtime path", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    await datasetService.ensureOutputImageStoreInstance({ instanceId: "instance:out", systemId: "system:image", datasetAssetId: "asset:dataset:out" });
    await datasetService.ensureWorkflowOutputTargetInstance({ targetType: "history-dataset", instanceId: "instance:hist", systemId: "system:image", datasetAssetId: "asset:dataset:hist" });
    await datasetService.ensureWorkflowOutputTargetInstance({ targetType: "comparison-dataset", instanceId: "instance:cmp", systemId: "system:image", datasetAssetId: "asset:dataset:cmp" });

    const service = new DefaultWorkflowRuntimeOutputPersistenceService(datasetService);
    const result = await service.persist({ input: createExecutionInput(), result: createExecutionResult() });

    expect(result.status).toBe("persisted");
    expect(result.persistedRecordCount).toBe(3);
    expect(result.handoff).toEqual(expect.objectContaining({
      handoffId: "handoff:image:5.2.4",
      traceId: "trace:image:5.2.4",
    }));
    expect(datasetService.listImageRecordsForInstance({ systemId: "system:image", instanceId: "instance:out" })).toHaveLength(1);
    const history = datasetService.listImageRecordsForInstance({ systemId: "system:image", instanceId: "instance:hist" });
    expect(history[0]?.metadata.historyEntryId).toBeString();
    expect((history[0]?.metadata.lineage as Record<string, unknown>).outputRelationship).toEqual(expect.objectContaining({
      metadata: expect.objectContaining({
        handoffId: "handoff:image:5.2.4",
        traceId: "trace:image:5.2.4",
      }),
    }));
    const comparison = datasetService.listImageRecordsForInstance({ systemId: "system:image", instanceId: "instance:cmp" });
    expect(comparison[0]?.metadata.comparisonSetId).toBe("set:abc");
  });

  it("returns structured failure when write-plan resolution fails", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    const service = new DefaultWorkflowRuntimeOutputPersistenceService(datasetService);
    const result = await service.persist({ input: createExecutionInput(), result: createExecutionResult() });

    expect(result.status).toBe("failed");
    expect(result.issues[0]?.code).toBe("dataset-instance-not-found");
  });

  it("records image-focused run history linked to persisted output records", async () => {
    const datasetService = new SystemDatasetInstanceService(
      new InMemoryDatasetInstanceRepository(),
      new StaticAssetCatalog(),
      undefined,
      new AllowAnySystem(),
    );
    await datasetService.ensureOutputImageStoreInstance({ instanceId: "instance:out", systemId: "system:image", datasetAssetId: "asset:dataset:out" });
    await datasetService.ensureWorkflowOutputTargetInstance({ targetType: "history-dataset", instanceId: "instance:hist", systemId: "system:image", datasetAssetId: "asset:dataset:hist" });
    await datasetService.ensureWorkflowOutputTargetInstance({ targetType: "comparison-dataset", instanceId: "instance:cmp", systemId: "system:image", datasetAssetId: "asset:dataset:cmp" });

    const historyService = new ImageRunHistoryService(
      new InMemoryImageRunHistoryRepository(),
      new OutputGalleryDatasetIntegrationService(datasetService),
      () => new Date("2026-04-02T10:00:00.000Z"),
    );
    const service = new DefaultWorkflowRuntimeOutputPersistenceService(datasetService, historyService);
    await service.persist({ input: createExecutionInput(), result: createExecutionResult() });

    const listing = historyService.listRuns({ systemId: "system:image" });
    expect(listing.runs).toHaveLength(1);
    expect(listing.runs[0]?.workflow.workflowAssetId).toBe("asset:workflow:image");
    expect(listing.runs[0]?.outputs.datasetInstance?.instanceId).toBe("instance:out");

    const detail = historyService.getRunWithLinkedOutputs({ systemId: "system:image", runId: "exec:1" });
    expect(detail?.linkedOutputs).toHaveLength(1);
    expect(detail?.linkedOutputs[0]?.workflow?.workflowRunId).toBe("exec:1");
  });
});
