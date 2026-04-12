import { describe, expect, it } from "bun:test";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
} from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import {
  SystemDatasetInstanceService,
  type SystemDatasetOwnershipValidator,
} from "../SystemDatasetInstanceService";
import { InMemoryWorkflowOutputArtifactStorage } from "../WorkflowOutputArtifactStorage";
import { InMemoryWorkflowOutputProvenanceRepository } from "../WorkflowOutputProvenanceRepository";
import { WorkflowOutputMaterializationService } from "../WorkflowOutputMaterializationService";
import type {
  PersistWorkflowOutputArtifactRequest,
  PersistWorkflowOutputArtifactResult,
  WorkflowOutputArtifactStorage,
} from "../WorkflowOutputArtifactStorage";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public resolveAsset(input: { readonly assetId: string; readonly versionId?: string }) {
    if (input.assetId.trim() !== "asset:dataset:outputs") {
      return undefined;
    }
    return Object.freeze({
      assetId: "asset:dataset:outputs",
      versionId: "v1",
      schemaIntentId: DatasetSchemaIntentIds.media as DatasetSchemaIntentId,
      outputShapeKind: "image-metadata-records" as const,
    });
  }
}

class AllowSystemValidator implements SystemDatasetOwnershipValidator {
  public assertSystemExists(systemId: string): void {
    if (systemId !== "system:image") {
      throw new Error("invalid-request:unknown-system");
    }
  }
}

const outputStorageBinding = Object.freeze({
  storageInstanceId: "storage-instance:test-runtime",
  storageInstanceRef: "storage-instance://storage-instance%3Atest-runtime",
  bindingId: "storage-binding:storage-instance:test-runtime:output",
  bindingReference: "storage-instance://storage-instance%3Atest-runtime/output",
  bindingArea: "output" as const,
});

describe("WorkflowOutputMaterializationService", () => {
  it("validates payloads and persists normalized generated image records into a system-owned dataset instance", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );

    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    const service = new WorkflowOutputMaterializationService(datasetInstances);
    const result = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: {
        materializationId: "mat:run:1",
        workflowRun: {
          runId: "run:1",
          workflowAssetId: "asset:workflow:image",
          workflowAssetVersionId: "v9",
        },
        producedAssets: [
          {
            assetRef: {
              kind: "generated-output",
              assetId: "asset:workflow-output:1",
              outputId: "asset:workflow-output:1",
            },
            role: "primary",
            outputIndex: 0,
            outputGroupId: "run:1:source:seed",
            metadata: {
              width: 768,
              height: 512,
              format: "png",
              filename: "generated-1.png",
            },
            tags: ["primary", "hero"],
          },
          {
            assetRef: {
              kind: "generated-output",
              assetId: "asset:workflow-output:2",
              outputId: "asset:workflow-output:2",
            },
            role: "variant",
            outputIndex: 1,
            outputGroupId: "run:1:source:seed",
            metadata: {
              width: 768,
              height: 512,
              mimeType: "image/webp",
              filename: "generated-2.webp",
            },
            tags: ["variant"],
          },
        ],
        parameterSnapshot: {
          prompt: "test",
        },
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          completedAt: "2026-04-01T10:00:02.000Z",
          updatedAt: "2026-04-01T10:00:02.000Z",
        },
        status: "materialized",
      },
    });

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.image.format).toBe("png");
    expect(result.records[1]?.image.format).toBe("webp");
    expect(result.records[0]?.generation?.runId).toBe("run:1");
    expect(result.records[0]?.generation?.metadata.materializationId).toBe("mat:run:1");
    expect(result.records[0]?.generation?.outputIndex).toBe(0);
    expect(result.records[0]?.generation?.outputGroupId).toBe("run:1:source:seed");
    expect(result.records[1]?.generation?.outputIndex).toBe(1);

    const persisted = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persisted).toHaveLength(2);
    expect(result.failures).toEqual([]);
  });

  it("persists binary output artifacts through system-owned storage contracts and captures provenance", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );
    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    const artifactStorage = new InMemoryWorkflowOutputArtifactStorage();
    const provenanceRepository = new InMemoryWorkflowOutputProvenanceRepository();
    const service = new WorkflowOutputMaterializationService(datasetInstances, artifactStorage, provenanceRepository);

    const result = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: {
        materializationId: "mat:run:binary-1",
        workflowRun: {
          runId: "run:binary:1",
          workflowAssetId: "asset:workflow:image",
          workflowAssetVersionId: "v10",
        },
        sourceImages: [{ imageRef: { kind: "generated-output", stableId: "generated-output:source:1", outputId: "source:1" } }],
        producedAssets: [
          {
            assetRef: {
              kind: "generated-output",
              outputId: "transient://comfy/image-1",
              stableId: "generated-output:transient-1",
            },
            role: "primary",
            outputIndex: 2,
            outputGroupId: "group:hero",
            sourceImageRef: { kind: "generated-output", stableId: "generated-output:source:hero", outputId: "source:hero" },
            metadata: { width: 32, height: 32, format: "png" },
            tags: ["primary"],
            binaryPayload: {
              dataBase64: Buffer.from([137, 80, 78, 71]).toString("base64"),
              fileNameHint: "Hero Final.png",
              extensionHint: "png",
              mimeTypeHint: "image/png",
            },
          },
        ],
        parameterSnapshot: { prompt: "hero" },
        executionContext: {
          runtimeProfile: "comfyui",
          capabilityProfile: { supportsCancellation: true },
          configurationSnapshot: { scheduler: "karras" },
        },
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          completedAt: "2026-04-01T10:00:03.000Z",
          updatedAt: "2026-04-01T10:00:03.000Z",
        },
        status: "materialized",
      },
    });

    const record = result.records[0];
    expect(record?.storage?.provider).toBe("in-memory-storage-instance-output-store");
    expect(record?.image.assetRef.stableId.startsWith("generated-output:storage-instance://")).toBe(true);

    const provenance = provenanceRepository.listByWorkflowRunId("run:binary:1");
    expect(provenance).toHaveLength(1);
    expect(provenance[0]?.workflowAssetVersionId).toBe("v10");
    expect(provenance[0]?.sourceImageStableIds).toEqual(["generated-output:source:hero", "generated-output:source:1"]);
    expect(provenance[0]?.outputIndex).toBe(2);
    expect(provenance[0]?.outputGroupId).toBe("group:hero");
    expect(provenance[0]?.parameterSnapshot.prompt).toBe("hero");
    expect(provenance[0]?.capabilityContext.supportsCancellation).toBe(true);

    const binary = artifactStorage.read(record?.storage?.reference ?? "missing");
    expect(binary?.byteLength).toBe(4);
    expect(result.failures).toEqual([]);
  });

  it("prefers storage-instance logical references over ephemeral runtime output references", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );
    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    const service = new WorkflowOutputMaterializationService(datasetInstances);
    const result = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: {
        materializationId: "mat:logical-ref:1",
        workflowRun: {
          runId: "run:logical-ref:1",
          workflowAssetId: "asset:workflow:image",
        },
        producedAssets: [{
          assetRef: {
            kind: "generated-output",
            outputId: "memory://comfy/output-1",
            stableId: "generated-output:memory://comfy/output-1",
            path: "C:/temp/raw-output.png",
          },
          role: "primary",
          metadata: {
            width: 640,
            height: 640,
            format: "png",
          },
          tags: ["primary"],
        }],
        parameterSnapshot: {},
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:02.000Z",
        },
        status: "materialized",
      },
    });

    expect(result.status).toBe("materialized");
    expect(result.records[0]?.storage?.reference).toContain("storage-instance://storage-instance%3Atest-runtime/output/runs/run%3Alogical-ref%3A1/mat%3Alogical-ref%3A1/0");
  });

  it("surfaces canonical materialization contract validation failures", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );

    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    const service = new WorkflowOutputMaterializationService(datasetInstances);

    await expect(service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: {
        materializationId: "",
        workflowRun: {
          runId: "run:bad",
          workflowAssetId: "asset:workflow:image",
        },
        producedAssets: [],
        parameterSnapshot: {},
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
        },
        status: "pending",
      },
    } as never)).rejects.toThrow();
  });

  it("rejects malformed runtime image records instead of silently defaulting dimensions/format", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );

    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    const service = new WorkflowOutputMaterializationService(datasetInstances);
    const result = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: {
        materializationId: "mat:run:invalid-shape",
        workflowRun: {
          runId: "run:invalid-shape",
          workflowAssetId: "asset:workflow:image",
        },
        producedAssets: [{
          assetRef: {
            kind: "generated-output",
            assetId: "asset:workflow-output:broken",
            outputId: "asset:workflow-output:broken",
          },
          role: "primary",
          metadata: {
            filename: "broken.png",
          },
          tags: [],
        }],
        parameterSnapshot: {},
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:01.000Z",
        },
        status: "materialized",
      },
    });

    expect(result.status).toBe("failed");
    expect(result.records).toHaveLength(0);
    expect(result.failures[0]?.code).toBe("invalid-request");
    expect(result.failures[0]?.message).toContain("missing width");
  });

  it("supports partial success and deterministic idempotent reprocessing for retries", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const datasetInstances = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog(),
      new AllowSystemValidator(),
    );
    await datasetInstances.ensureOutputImageStoreInstance({
      instanceId: "instance:outputs",
      systemId: "system:image",
      datasetAssetId: "asset:dataset:outputs",
      datasetAssetVersionId: "v1",
      storageBinding: outputStorageBinding,
    });

    class FlakyArtifactStorage implements WorkflowOutputArtifactStorage {
      private readonly failedOnce = new Set<number>();

      public async persist(request: PersistWorkflowOutputArtifactRequest): Promise<PersistWorkflowOutputArtifactResult> {
        if (request.assetIndex === 1 && !this.failedOnce.has(1)) {
          this.failedOnce.add(1);
          throw new Error("simulated-artifact-write-failure");
        }
        return Object.freeze({
          storageReference: `${request.datasetStorageBinding.bindingReference}/runs/${request.materializationId}/${request.assetIndex}`,
          storageProvider: "flaky-memory-store",
          assetRef: Object.freeze({
            kind: "generated-output",
            stableId: `generated-output:${request.datasetStorageBinding.bindingReference}/runs/${request.materializationId}/${request.assetIndex}`,
            outputId: `${request.datasetStorageBinding.bindingReference}/runs/${request.materializationId}/${request.assetIndex}`,
            path: `output-${request.assetIndex}.png`,
            sourceSystem: "flaky-test",
            sourceContext: Object.freeze({ role: request.role }),
            mimeTypeHint: "image/png",
            formatHint: "png",
          }),
          metadata: Object.freeze({ sizeBytes: request.payload.byteLength }),
        });
      }
    }

    const provenanceRepository = new InMemoryWorkflowOutputProvenanceRepository();
    const service = new WorkflowOutputMaterializationService(
      datasetInstances,
      new FlakyArtifactStorage(),
      provenanceRepository,
    );

    const basePayload = {
      materializationId: "mat:retry:1",
      workflowRun: {
        runId: "run:retry:1",
        workflowAssetId: "asset:workflow:image",
      },
      producedAssets: [0, 1].map((index) => ({
        assetRef: {
          kind: "generated-output" as const,
          stableId: `generated-output:transient:${index}`,
          outputId: `transient://${index}`,
        },
        role: index === 0 ? "primary" as const : "variant" as const,
        metadata: { width: 64, height: 64, format: "png" },
        tags: [index === 0 ? "primary" : "variant"],
        binaryPayload: {
          dataBase64: Buffer.from([1, 2, 3, index]).toString("base64"),
          extensionHint: "png",
          mimeTypeHint: "image/png",
        },
      })),
      parameterSnapshot: { prompt: "retry me" },
      timestamps: {
        requestedAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:01.000Z",
      },
      status: "materialized" as const,
    };

    const first = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: basePayload,
    });
    expect(first.status).toBe("partial");
    expect(first.records).toHaveLength(1);
    expect(first.failures).toHaveLength(1);
    expect(first.failures[0]?.code).toBe("artifact-persist-failed");

    const second = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: basePayload,
    });
    expect(second.status).toBe("materialized");
    expect(second.records).toHaveLength(2);
    expect(second.failures).toEqual([]);

    const persisted = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persisted).toHaveLength(2);
    expect(new Set(persisted.map((record) => record.recordId)).size).toBe(2);

    const duplicateDelivery = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload: basePayload,
    });
    expect(duplicateDelivery.status).toBe("materialized");
    const persistedAfterDuplicate = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persistedAfterDuplicate).toHaveLength(2);

    const provenance = provenanceRepository.listByWorkflowRunId("run:retry:1");
    expect(provenance).toHaveLength(2);
  });
});

