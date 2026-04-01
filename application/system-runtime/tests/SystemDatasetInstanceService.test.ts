import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
} from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";

class StaticAssetCatalog implements DatasetInstanceAssetCatalog {
  public constructor(
    private readonly entries: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly schemaIntentId: DatasetSchemaIntentId;
      readonly outputShapeKind: "records" | "image-metadata-records";
    }>,
  ) {}

  public resolveAsset(input: {
    readonly assetId: string;
    readonly versionId?: string;
  }) {
    const assetId = input.assetId.trim();
    const versionId = input.versionId?.trim();
    return this.entries.find((entry) =>
      entry.assetId === assetId
      && (versionId ? entry.versionId === versionId : true)
    );
  }
}

class AllowListSystemValidator implements SystemDatasetOwnershipValidator {
  public constructor(private readonly allowedSystemIds: ReadonlyArray<string>) {}

  public assertSystemExists(systemId: string): void {
    if (!this.allowedSystemIds.includes(systemId)) {
      throw new Error(`invalid-request:System '${systemId}' is not available.`);
    }
  }
}

describe("SystemDatasetInstanceService", () => {
  it("creates and lists dataset instances with runtime-owned identity distinct from dataset asset definitions", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-ingestor-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const created = await service.createDatasetInstance({
      instanceId: "dataset-instance:input:1",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images",
      seedMetadata: {
        bucket: "input-a",
        retainDays: 14,
      },
    });

    expect(created.instanceId).toBe("dataset-instance:input:1");
    expect(created.datasetAssetId).toBe("image-ingestor-v1");
    expect(created.systemId).toBe("system:image-pipeline");
    expect(created.role).toBe("input-store");

    const listed = service.listSystemDatasetInstances("system:image-pipeline");
    expect(listed.length).toBe(1);
    expect(listed[0]?.instanceId).toBe("dataset-instance:input:1");
    expect(listed[0]?.datasetAssetId).toBe("image-ingestor-v1");
  });

  it("creates input image stores through role configuration and remains idempotent", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-ingestor-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const first = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:input-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });
    const second = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:input-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    expect(first.instanceId).toBe(second.instanceId);
    expect(first.role).toBe("input-store");
    expect(first.purpose).toBe("incoming-images");
    expect(service.listSystemDatasetInstances("system:image-pipeline").length).toBe(1);
  });

  it("creates output image stores through the shared role ensure path and remains idempotent", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-exporter-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const first = await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:output-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
      seedMetadata: {
        targetCollection: "studio-results",
      },
    });
    const second = await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:output-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
    });

    expect(first.instanceId).toBe(second.instanceId);
    expect(first.role).toBe("output-store");
    expect(first.purpose).toBe("workflow-output-images");
    expect(first.seedMetadata?.targetCollection).toBe("studio-results");
    expect(service.listSystemDatasetInstances("system:image-pipeline").length).toBe(1);
  });

  it("creates optional intermediate stores with lifecycle metadata via shared dataset instance contracts", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-transform-stage-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const created = await service.ensureIntermediateStoreInstance({
      instanceId: "dataset-instance:intermediate-stage-1",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-transform-stage-v1",
      datasetAssetVersionId: "1.0.0",
      purpose: "stage:denoise",
      lifecycleMetadata: {
        retentionPolicy: "ttl",
        maxAgeDays: 2,
        cleanupStatus: "pending",
      },
      seedMetadata: {
        stageId: "denoise",
      },
    });

    expect(created.role).toBe("intermediate-store");
    expect(created.purpose).toBe("stage:denoise");
    expect(created.lifecycleMetadata?.retentionPolicy).toBe("ttl");
    expect(created.lifecycleMetadata?.maxAgeDays).toBe(2);
    expect(created.lifecycleMetadata?.cleanupStatus).toBe("pending");
    expect(created.seedMetadata?.stageId).toBe("denoise");

    const reloaded = service.getDatasetInstance("dataset-instance:intermediate-stage-1");
    expect(reloaded?.role).toBe("intermediate-store");
    expect(reloaded?.lifecycleMetadata?.maxAgeDays).toBe(2);
  });

  it("rejects invalid system ownership, asset linkage, and role schema requirements", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "tabular-ingestor-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.tabular,
          outputShapeKind: "records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    await expect(service.createDatasetInstance({
      instanceId: "dataset-instance:bad-owner",
      systemId: "system:missing",
      datasetAssetId: "tabular-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
    })).rejects.toThrow("invalid-request:System 'system:missing' is not available.");

    await expect(service.createDatasetInstance({
      instanceId: "dataset-instance:bad-asset",
      systemId: "system:image-pipeline",
      datasetAssetId: "missing-asset",
      role: "input-store",
    })).rejects.toThrow("invalid-request:Dataset asset 'missing-asset@latest' is not registered.");

    await expect(service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:wrong-schema",
      systemId: "system:image-pipeline",
      datasetAssetId: "tabular-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    })).rejects.toThrow("expected 'media'");

    await expect(service.createDatasetInstance({
      instanceId: "dataset-instance:bad-role",
      systemId: "system:image-pipeline",
      datasetAssetId: "tabular-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "unknown-role" as never,
    })).rejects.toThrow("role 'unknown-role' is not supported");
  });

  it("rejects conflicting role/purpose linkage and invalid intermediate lifecycle metadata", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-transform-stage-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
        {
          assetId: "image-transform-stage-v2",
          versionId: "2.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    await service.ensureIntermediateStoreInstance({
      instanceId: "dataset-instance:intermediate-stage",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-transform-stage-v1",
      datasetAssetVersionId: "1.0.0",
      purpose: "stage:compose",
    });

    await expect(service.ensureIntermediateStoreInstance({
      instanceId: "dataset-instance:intermediate-stage-2",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-transform-stage-v2",
      datasetAssetVersionId: "2.0.0",
      purpose: "stage:compose",
    })).rejects.toThrow("already has a 'intermediate-store' dataset instance");

    await expect(service.ensureIntermediateStoreInstance({
      instanceId: "dataset-instance:intermediate-invalid-lifecycle",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-transform-stage-v1",
      datasetAssetVersionId: "1.0.0",
      purpose: "stage:sharpen",
      lifecycleMetadata: {
        retentionPolicy: "ttl",
      },
    })).rejects.toThrow("must set maxAgeDays when retentionPolicy is ttl");
  });

  it("enforces incoming image schema compliance through the dataset asset/instance boundary", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([
        {
          assetId: "image-ingestor-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:input-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const validShape = createCanonicalImageMetadataRecordsShape({
      items: [
        {
          itemId: "img-1",
          imageId: "img-1",
          attributes: {
            assetRef: { assetId: "asset:image:img-1" },
            width: 512,
            height: 512,
            format: "png",
          },
        },
      ],
      metadata: { schemaVersion: "1.0.0" },
    });

    const valid = service.validateIncomingShapeForInstance({
      instanceId: instance.instanceId,
      shape: validShape,
    });
    expect(valid.valid).toBeTrue();

    const invalidShape = createCanonicalRecordsShape({
      records: [
        {
          recordId: "bad-1",
          fields: { text: "not-an-image-record" },
        },
      ],
      metadata: { schemaVersion: "1.0.0" },
    });
    expect(() => service.validateIncomingShapeForInstance({
      instanceId: instance.instanceId,
      shape: invalidShape,
    })).toThrow("is incompatible with dataset asset output shape");
  });
});
