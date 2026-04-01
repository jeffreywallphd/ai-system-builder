import { describe, expect, it } from "bun:test";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
} from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import {
  SystemDatasetInstanceService,
  type SystemDatasetOwnershipValidator,
} from "../SystemDatasetInstanceService";
import { InMemoryWorkflowOutputArtifactStorage } from "../WorkflowOutputArtifactStorage";
import { InMemoryWorkflowOutputProvenanceRepository } from "../WorkflowOutputProvenanceRepository";
import { WorkflowOutputMaterializationService } from "../WorkflowOutputMaterializationService";

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

    const persisted = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persisted).toHaveLength(2);
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
    expect(record?.storage?.provider).toBe("in-memory-system-output-store");
    expect(record?.image.assetRef.stableId.startsWith("generated-output:system-output://")).toBe(true);

    const provenance = provenanceRepository.listByWorkflowRunId("run:binary:1");
    expect(provenance).toHaveLength(1);
    expect(provenance[0]?.workflowAssetVersionId).toBe("v10");
    expect(provenance[0]?.sourceImageStableIds).toEqual(["generated-output:source:1"]);
    expect(provenance[0]?.parameterSnapshot.prompt).toBe("hero");
    expect(provenance[0]?.capabilityContext.supportsCancellation).toBe(true);

    const binary = artifactStorage.read(record?.storage?.reference ?? "missing");
    expect(binary?.byteLength).toBe(4);
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
});
