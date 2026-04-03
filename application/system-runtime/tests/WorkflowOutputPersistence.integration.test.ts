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
import { ComfyExecutionResultMaterializationMapper } from "../../../infrastructure/comfyui/execution/mappers/ComfyExecutionResultMaterializationMapper";

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

describe("Workflow output persistence integration", () => {
  it("materializes mapped execution outputs into system-owned dataset records with provenance and idempotency", async () => {
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

    const mapper = new ComfyExecutionResultMaterializationMapper();
    const artifactStorage = new InMemoryWorkflowOutputArtifactStorage();
    const provenance = new InMemoryWorkflowOutputProvenanceRepository();
    const service = new WorkflowOutputMaterializationService(datasetInstances, artifactStorage, provenance);

    const mapped = mapper.map({
      workflowRun: {
        runId: "run:integration:1",
        workflowAssetId: "asset:workflow:image",
        workflowAssetVersionId: "v5",
      },
      result: {
        executionId: "exec:integration:1",
        status: "completed",
        outputs: [
          {
            nodeId: "save_1",
            kind: "image",
            reference: "output:1",
            metadata: {
              filename: "primary.png",
              width: 128,
              height: 128,
              outputGroupId: "group:integration",
            },
          },
          {
            nodeId: "save_2",
            kind: "image",
            reference: "output:2",
            metadata: {
              filename: "variant.png",
              width: 128,
              height: 128,
              outputGroupId: "group:integration",
            },
          },
        ],
        lifecycle: [],
      },
      parameterSnapshot: { prompt: "integration" },
    });

    const payload = {
      ...mapped,
      producedAssets: mapped.producedAssets.map((asset, index) => ({
        ...asset,
        binaryPayload: {
          dataBase64: Buffer.from([137, 80, 78, 71, index]).toString("base64"),
          extensionHint: "png",
          mimeTypeHint: "image/png",
        },
      })),
    };

    const first = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload,
    });

    expect(first.status).toBe("materialized");
    expect(first.records).toHaveLength(2);
    expect(first.failures).toEqual([]);
    expect(first.records[0]?.generation?.outputGroupId).toBe("group:integration");

    const duplicate = await service.materialize({
      systemId: "system:image",
      datasetInstanceId: "instance:outputs",
      payload,
    });
    expect(duplicate.status).toBe("materialized");
    expect(duplicate.records).toHaveLength(2);

    const persisted = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persisted).toHaveLength(2);

    const provenanceRecords = provenance.query({ workflowRunId: "run:integration:1" });
    expect(provenanceRecords).toHaveLength(2);
    expect(provenanceRecords[0]?.workflowAssetId).toBe("asset:workflow:image");

    const binary = artifactStorage.read(first.records[0]?.storage?.reference ?? "missing");
    expect(binary?.byteLength).toBe(5);
  });

  it("supports failed execution results before output materialization without creating dataset records", async () => {
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
        materializationId: "mat:failed-before-output",
        workflowRun: {
          runId: "run:failed-before-output",
          workflowAssetId: "asset:workflow:image",
        },
        producedAssets: [],
        parameterSnapshot: {},
        timestamps: {
          requestedAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:01.000Z",
        },
        status: "failed",
        error: {
          code: "execution-failed",
          message: "Executor failed before producing outputs",
          retriable: true,
        },
      },
    });

    expect(result.status).toBe("failed");
    expect(result.records).toEqual([]);
    expect(result.failures).toEqual([]);

    const persisted = datasetInstances.listImageRecordsForInstance({
      systemId: "system:image",
      instanceId: "instance:outputs",
    });
    expect(persisted).toHaveLength(0);
  });
});
