import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "@domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
} from "@domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { IImageMetadataExtractor } from "@domain/dataset-studio/interfaces/ImageMetadataExtraction";
import type { ImageRecord } from "@domain/dataset-studio/contracts/ImageRecord";
import {
  createMediaValidationIssue,
  createMediaValidationResult,
  type IMediaRecordValidator,
} from "@domain/dataset-studio/interfaces/MediaValidation";
import { ZodMediaDatasetValidator } from "../../dataset-studio/adapters/validation/MediaDatasetValidator";
import type { DatasetInstanceAssetCatalog } from "../DatasetInstanceAssetCatalog";
import { InMemoryDatasetInstanceRepository } from "../DatasetInstanceRepository";
import type { SystemDatasetOwnershipValidator } from "../SystemDatasetInstanceService";
import { SystemDatasetInstanceService } from "../SystemDatasetInstanceService";
import { InMemoryDatasetEventPublisher, type DatasetEventPublisher } from "../../dataset-events/DatasetEventPublisher";
import { DatasetEventTypes } from "@domain/dataset-studio/contracts/DatasetEvent";
import { InMemoryDatasetOperationalLineageSink } from "../DatasetOperationalLineage";
import { WorkflowOutputTargetTypes } from "@domain/system-runtime/WorkflowOutputTargetDomain";

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

class StaticImageMetadataExtractor implements IImageMetadataExtractor {
  public async extract(_payload: Uint8Array): Promise<{
    readonly dimensions: { readonly width: number; readonly height: number };
    readonly formatHint: { readonly format: string; readonly mimeType: string };
    readonly exif: { readonly make: string };
    readonly additionalMetadata: { readonly extractedBy: string };
  }> {
    return Object.freeze({
      dimensions: Object.freeze({ width: 1600, height: 900 }),
      formatHint: Object.freeze({ format: "png", mimeType: "image/png" }),
      exif: Object.freeze({ make: "Camera-A" }),
      additionalMetadata: Object.freeze({ extractedBy: "static-extractor" }),
    });
  }
}

class BlockedTagMediaRecordValidator implements IMediaRecordValidator {
  public validateRecord(input: unknown) {
    const records = this.validateRecords([input], "record");
    if (!records.valid || !records.value || records.value.length === 0) {
      return createMediaValidationResult(records.issues);
    }
    return createMediaValidationResult(records.issues, records.value[0]);
  }

  public validateRecords(input: unknown): ReturnType<IMediaRecordValidator["validateRecords"]> {
    if (!Array.isArray(input)) {
      return createMediaValidationResult([
        createMediaValidationIssue({
          code: "media-records-not-array",
          message: "Expected record array.",
        }),
      ]);
    }
    const blocked = input.find((entry) => {
      const record = entry as { readonly tags?: unknown };
      return Array.isArray(record?.tags) && record.tags.includes("blocked-tag");
    });
    if (blocked) {
      return createMediaValidationResult([
        createMediaValidationIssue({
          code: "media-tag-blocked",
          message: "Blocked tag is not allowed.",
          path: "records.tags",
        }),
      ]);
    }

    return createMediaValidationResult([], Object.freeze([...input] as ReadonlyArray<ImageRecord>));
  }
}

class ThrowingDatasetEventPublisher implements DatasetEventPublisher {
  public publish(): never {
    throw new Error("dataset-event-publish-failed");
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

  it("binds dataset instances to versioned logical storage bindings instead of filesystem paths", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([{
        assetId: "image-ingestor-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const created = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:input-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      storageContractVersion: "2.0.0",
      storageBindings: [
        {
          storageInstanceId: "storage-instance:shared-reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
          bindingArea: "input",
          bindingId: "storage-binding:storage-instance:shared-reference-runtime:input",
          bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
        },
        {
          storageInstanceId: "storage-instance:shared-reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
          bindingArea: "reference",
          bindingId: "storage-binding:storage-instance:shared-reference-runtime:reference",
          bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/reference",
        },
      ],
    });
    expect(created.storageBindings?.map((entry) => entry.bindingArea)).toEqual(["input", "reference"]);
    expect(created.storageBinding?.bindingReference).toBe("storage-instance://storage-instance%3Ashared-reference-runtime/input");

    await expect(service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:input-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
        bindingArea: "input",
        bindingId: "/tmp/input-path",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
      }],
    } as unknown as Parameters<SystemDatasetInstanceService["ensureInputImageStoreInstance"]>[0])).rejects.toThrow(
      "different storage binding linkage",
    );

    await expect(service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:path-config",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images",
      storagePath: "/tmp/raw-path",
    } as unknown as Parameters<SystemDatasetInstanceService["ensureRoleDatasetInstance"]>[0])).rejects.toThrow(
      "must use storage-instance references",
    );

    await expect(service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:bad-binding-ref",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images-v2",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
        bindingArea: "input",
        bindingId: "storage-binding:storage-instance:shared-reference-runtime:input",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input/uploads",
      }],
    })).rejects.toThrow("must target an instance root or a single logical area");

    await expect(service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:bad-instance-ref",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images-v3",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
        bindingArea: "input",
        bindingId: "storage-binding:storage-instance:shared-reference-runtime:input",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
      }],
    })).rejects.toThrow("storageInstanceRef must target only the storage instance root reference");

    await expect(service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:duplicate-area",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images-v4",
      storageBindings: [
        {
          storageInstanceId: "storage-instance:shared-reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
          bindingArea: "input",
          bindingId: "storage-binding:shared-reference-runtime:input-a",
          bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
        },
        {
          storageInstanceId: "storage-instance:shared-reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
          bindingArea: "input",
          bindingId: "storage-binding:shared-reference-runtime:input-b",
          bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
        },
      ],
    })).rejects.toThrow("duplicate area");
  });

  it("supports reference/intermediate/output dataset bindings across one shared storage instance", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([{
        assetId: "image-exporter-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const output = await service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:output-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
      role: "output-store",
      purpose: "workflow-output-images",
      storageBinding: {
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
        bindingArea: "output",
        bindingId: "storage-binding:storage-instance:shared-reference-runtime:output",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/output",
      },
    });
    const intermediate = await service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:intermediate-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
      role: "intermediate-store",
      purpose: "workflow-intermediate-images",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
        bindingArea: "intermediate",
        bindingId: "storage-binding:storage-instance:shared-reference-runtime:intermediate",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/intermediate",
      }],
    });
    const reference = await service.ensureRoleDatasetInstance({
      instanceId: "dataset-instance:reference-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "workflow-reference-images",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-reference-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
        bindingArea: "reference",
        bindingId: "storage-binding:storage-instance:shared-reference-runtime:reference",
        bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/reference",
      }],
    });

    expect(output.storageBinding?.bindingArea).toBe("output");
    expect(intermediate.storageBinding?.bindingArea).toBe("intermediate");
    expect(reference.storageBinding?.bindingArea).toBe("reference");
    expect(service.listSystemDatasetInstances("system:image-pipeline").length).toBe(3);
  });

  it("models canonical workflow output target types through a composable ensure path", async () => {
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

    const history = await service.ensureWorkflowOutputTargetInstance({
      targetType: WorkflowOutputTargetTypes.historyDataset,
      instanceId: "dataset-instance:history-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const comparison = await service.ensureWorkflowOutputTargetInstance({
      targetType: WorkflowOutputTargetTypes.comparisonDataset,
      instanceId: "dataset-instance:comparison-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
      purpose: "image-compare-inspection",
    });

    expect(history.role).toBe("output-store");
    expect(history.purpose).toBe("workflow-output-history-images");
    expect(comparison.role).toBe("output-store");
    expect(comparison.purpose).toBe("image-compare-inspection");
  });

  it("supports cross-system dataset-instance reuse through explicit access bindings", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([{
        assetId: "image-ingestor-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:owner", "system:consumer"]),
    );

    const ownerInstance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:shared-input",
      systemId: "system:owner",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      storageBindings: [{
        storageInstanceId: "storage-instance:shared-runtime",
        storageInstanceRef: "storage-instance://storage-instance%3Ashared-runtime",
        bindingArea: "input",
        bindingId: "storage-binding:storage-instance:shared-runtime:input",
        bindingReference: "storage-instance://storage-instance%3Ashared-runtime/input",
      }],
    });
    const bound = await service.bindDatasetInstanceByRole({
      systemId: "system:consumer",
      instanceId: ownerInstance.instanceId,
      role: "input",
    });
    expect(bound.systemId).toBe("system:consumer");
    expect(bound.instanceId).toBe(ownerInstance.instanceId);

    const reused = await service.ensureRoleDatasetInstance({
      instanceId: ownerInstance.instanceId,
      systemId: "system:consumer",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      role: "input-store",
      purpose: "incoming-images",
      reuseFromInstanceId: ownerInstance.instanceId,
    });
    expect(reused.instanceId).toBe(ownerInstance.instanceId);
    expect(reused.accessBindings?.map((entry) => entry.accessorId)).toContain("system:consumer");
    expect(reused.storageBindings?.[0]?.storageInstanceId).toBe("storage-instance:shared-runtime");

    const ingested = await service.ingestImageRecordIntoInstance({
      systemId: "system:consumer",
      instanceId: ownerInstance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:shared-consumer" },
        width: 512,
        height: 512,
        format: "png",
      },
    });
    expect(ingested.instanceId).toBe(ownerInstance.instanceId);
    expect(ingested.systemId).toBe("system:owner");

    const listed = service.listImageRecordsForInstance({
      systemId: "system:consumer",
      instanceId: ownerInstance.instanceId,
    });
    expect(listed.length).toBe(1);
    expect(listed[0]?.recordId).toBe(ingested.recordId);
  });

  it("supports shared dataset-instance access between a parent system and embedded subsystem", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const service = new SystemDatasetInstanceService(
      repository,
      new StaticAssetCatalog([{
        assetId: "image-exporter-v1",
        versionId: "1.0.0",
        schemaIntentId: DatasetSchemaIntentIds.media,
        outputShapeKind: "image-metadata-records",
      }]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:root"]),
    );
    const parentSystemId = "system:root";
    const embeddedSubsystemId = "system:root::subsystem:enhance";
    const shared = await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:shared-output",
      systemId: parentSystemId,
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
    });
    await service.bindDatasetInstanceByRole({
      systemId: embeddedSubsystemId,
      instanceId: shared.instanceId,
      role: "output",
      accessorKind: "embedded-subsystem",
      accessorRole: "embedded-output-store",
    });

    const ingested = await service.ingestImageRecordIntoInstance({
      systemId: embeddedSubsystemId,
      instanceId: shared.instanceId,
      record: {
        assetRef: { assetId: "asset:image:embedded-output" },
        width: 768,
        height: 768,
        format: "png",
      },
    });
    expect(ingested.systemId).toBe(parentSystemId);

    const parentRead = service.getImageRecordFromInstance({
      systemId: parentSystemId,
      instanceId: shared.instanceId,
      recordId: ingested.recordId,
    });
    expect(parentRead?.recordId).toBe(ingested.recordId);
    expect(service.listSystemDatasetBindings(embeddedSubsystemId).some((binding) => binding.instanceId === shared.instanceId)).toBeTrue();
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

    const reloaded = service.getDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: "dataset-instance:intermediate-stage-1",
    });
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
      systemId: "system:image-pipeline",
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
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      shape: invalidShape,
    })).toThrow("is incompatible with dataset asset output shape");
  });

  it("binds system-owned dataset instances by explicit binding role and resolves role lookups", async () => {
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
        {
          assetId: "image-exporter-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
        {
          assetId: "image-stage-v1",
          versionId: "1.0.0",
          schemaIntentId: DatasetSchemaIntentIds.media,
          outputShapeKind: "image-metadata-records",
        },
      ]),
      new ZodMediaDatasetValidator(),
      new AllowListSystemValidator(["system:image-pipeline"]),
    );

    const inputInstance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:binding-input",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });
    await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:binding-output",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-exporter-v1",
      datasetAssetVersionId: "1.0.0",
    });
    await service.ensureIntermediateStoreInstance({
      instanceId: "dataset-instance:binding-intermediate",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-stage-v1",
      datasetAssetVersionId: "1.0.0",
      purpose: "stage:enhance",
    });

    const boundInput = await service.bindDatasetInstanceByRole({
      systemId: "system:image-pipeline",
      instanceId: inputInstance.instanceId,
      role: "input",
      purpose: "incoming-images",
    });
    expect(boundInput.role).toBe("input");
    expect(boundInput.instanceId).toBe("dataset-instance:binding-input");

    const outputBinding = service.getSystemDatasetBindingByRole({
      systemId: "system:image-pipeline",
      role: "output",
      purpose: "workflow-output-images",
    });
    expect(outputBinding?.instanceId).toBe("dataset-instance:binding-output");

    const intermediateLookup = service.getBoundDatasetInstanceByRole({
      systemId: "system:image-pipeline",
      role: "intermediate",
      purpose: "stage:enhance",
    });
    expect(intermediateLookup?.instanceId).toBe("dataset-instance:binding-intermediate");

    const allBindings = service.listSystemDatasetBindings("system:image-pipeline");
    expect(allBindings.map((binding) => binding.role).sort()).toEqual(["input", "intermediate", "output"]);
  });

  it("rejects invalid binding ownership and role mismatches", async () => {
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
      new AllowListSystemValidator(["system:image-pipeline", "system:other"]),
    );

    await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:ownership-check",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await expect(service.bindDatasetInstanceByRole({
      systemId: "system:other",
      instanceId: "dataset-instance:ownership-check",
      role: "input",
      purpose: "incoming-images",
    })).rejects.toThrow("System 'system:other' is not available");

    await expect(service.bindDatasetInstanceByRole({
      systemId: "system:image-pipeline",
      instanceId: "dataset-instance:ownership-check",
      role: "output",
      purpose: "incoming-images",
    })).rejects.toThrow("expected 'output-store' for binding role 'output'");
  });

  it("enforces schema at instance record-admission boundary for image-oriented records", async () => {
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
      instanceId: "dataset-instance:admission-input",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const admitted = service.admitRecordForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:img-1" },
        width: 1024,
        height: 768,
        format: "png",
        metadata: { source: "camera-a" },
        tags: ["portrait"],
        derived: { exposure: "balanced" },
      },
    }) as Record<string, unknown>;

    expect(admitted.width).toBe(1024);
    expect(admitted.height).toBe(768);
    expect(admitted.format).toBe("png");

    const validation = service.validateRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          assetRef: { assetId: "asset:image:img-2" },
          width: 512,
          height: 512,
          format: "jpeg",
          metadata: { source: "camera-b" },
          tags: ["thumbnail"],
        },
      ]),
    });
    expect(validation.valid).toBeTrue();

    expect(() => service.admitRecordForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:img-invalid" },
        width: 512,
        height: 512,
      },
    })).toThrow("rejected record admission");
  });

  it("ingests image records into system-owned instances with metadata extraction and storage reference persistence", async () => {
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
      {
        imageMetadataExtractor: new StaticImageMetadataExtractor(),
      },
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:ingest-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const ingested = await service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:image-1",
      storageReference: "prepared://incoming/image-1",
      storageProvider: "prepared-store",
      record: {
        tags: ["input", "hero"],
      },
      metadata: {
        ingestionSource: "system-upload",
      },
      provenance: {
        sourceType: "upload",
        sourceReference: "upload:session-1:file-1",
        ingestedBy: "user:tester",
      },
      metadataExtraction: {
        payload: new Uint8Array([1, 2, 3, 4]),
        includeExifInMetadata: true,
      },
    });

    expect(ingested.recordId).toBe("record:image-1");
    expect(ingested.instanceId).toBe("dataset-instance:ingest-images");
    expect(ingested.systemId).toBe("system:image-pipeline");
    expect(ingested.image.width).toBe(1600);
    expect(ingested.image.height).toBe(900);
    expect(ingested.image.format).toBe("png");
    expect(ingested.storage?.reference).toBe("prepared://incoming/image-1");
    expect(ingested.storage?.provider).toBe("prepared-store");
    expect(ingested.image.metadata.extractedBy).toBe("static-extractor");
    expect(ingested.image.metadata.exif).toEqual({ make: "Camera-A" });
    expect(ingested.metadata.ingestionSource).toBe("system-upload");
    expect(ingested.provenance.sourceType).toBe("upload");
    expect(ingested.provenance.sourceReference).toBe("upload:session-1:file-1");
    expect(ingested.provenance.ingestedBy).toBe("user:tester");

    const listed = service.listImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(listed.length).toBe(1);
    expect(listed[0]?.recordId).toBe("record:image-1");
  });

  it("ingests image records using dataset storage binding areas without caller-provided storage paths", async () => {
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
      instanceId: "dataset-instance:binding-ingest",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      storageBindings: [
        {
          storageInstanceId: "storage-instance:shared-reference-runtime",
          storageInstanceRef: "storage-instance://storage-instance%3Ashared-reference-runtime",
          bindingArea: "input",
          bindingId: "storage-binding:shared-reference-runtime:input",
          bindingReference: "storage-instance://storage-instance%3Ashared-reference-runtime/input",
        },
      ],
    });

    const ingested = await service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      storageBindingArea: "input",
      record: {
        width: 1024,
        height: 1024,
        format: "png",
      },
    });

    expect(ingested.storage?.reference).toBe("storage-instance://storage-instance%3Ashared-reference-runtime/input");
    expect(ingested.image.assetRef?.stableId).toBe("generated-output:storage-instance://storage-instance%3Ashared-reference-runtime/input");
  });

  it("rejects invalid ingested image records and enforces system ownership on retrieval", async () => {
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
      new AllowListSystemValidator(["system:image-pipeline", "system:other"]),
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:invalid-ingest",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await expect(service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:bad-1" },
        width: 512,
        height: 512,
      },
    })).rejects.toThrow("rejected record admission");

    await service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:image-owned",
      record: {
        assetRef: { assetId: "asset:image:ok-1" },
        width: 512,
        height: 512,
        format: "png",
      },
    });

    expect(() => service.getImageRecordFromInstance({
      systemId: "system:other",
      instanceId: instance.instanceId,
      recordId: "record:image-owned",
    })).toThrow("is not bound to system/subsystem 'system:other'");
  });

  it("lists and queries ingested records by image query contracts (tags/format/dimensions/metadata/derived/identifiers)", async () => {
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
      instanceId: "dataset-instance:query-images",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          recordId: "record:query-1",
          record: {
            assetRef: { assetId: "asset:image:query-1" },
            width: 1024,
            height: 1024,
            format: "png",
            mimeType: "image/png",
            tags: ["featured", "hero"],
            metadata: { source: "camera-a", cameraModel: "A1" },
            derived: { orientation: "square" },
          },
          storageReference: "prepared://query-1",
        },
        {
          recordId: "record:query-2",
          record: {
            assetRef: { assetId: "asset:image:query-2" },
            width: 512,
            height: 512,
            format: "jpeg",
            tags: ["thumbnail"],
            metadata: { source: "camera-b" },
          },
        },
      ]),
    });

    const all = service.listImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(all.length).toBe(2);

    const byId = service.getImageRecordFromInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:query-1",
    });
    expect(byId?.image.assetRef.stableId).toContain("asset:image:query-1");

    const queried = service.listImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      query: {
        format: "png",
        mimeType: "image/png",
        tagsAny: ["hero", "missing"],
        tagsAll: ["featured"],
        minWidth: 800,
        metadata: {
          source: "camera-a",
        },
        derived: {
          orientation: "square",
        },
        recordIds: ["record:query-1", "record:query-3"],
        storageReference: "prepared://query-1",
      },
    });
    expect(queried.length).toBe(1);
    expect(queried[0]?.recordId).toBe("record:query-1");
  });

  it("updates instance image records with controlled metadata/tag/derived mutation and centralized schema validation", async () => {
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
      instanceId: "dataset-instance:mutate-record",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:mutable-1",
      record: {
        assetRef: { assetId: "asset:image:mutable-1" },
        width: 640,
        height: 480,
        format: "png",
        metadata: { source: "camera-a", scene: "base" },
        tags: ["seed"],
        derived: { orientation: "landscape" },
      },
      metadata: { ingestionStage: "input" },
    });

    const updated = await service.updateImageRecordInInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:mutable-1",
      patch: {
        imagePatch: {
          tagsPatch: {
            add: ["hero"],
          },
          metadataPatch: {
            set: { source: "camera-b", quality: "high" },
            remove: ["scene"],
          },
          derived: {
            orientation: "landscape",
            megapixels: 0.31,
          },
        },
        metadataPatch: {
          set: { ingestionStage: "mutation", reviewState: "approved" },
        },
      },
    });

    expect(updated.recordId).toBe("record:mutable-1");
    expect(updated.image.tags).toEqual(["seed", "hero"]);
    expect(updated.image.metadata.source).toBe("camera-b");
    expect(updated.image.metadata.scene).toBeUndefined();
    expect(updated.image.metadata.quality).toBe("high");
    expect(updated.image.derived.megapixels).toBe(0.31);
    expect(updated.metadata.ingestionStage).toBe("mutation");
    expect(updated.metadata.reviewState).toBe("approved");
    expect(updated.mutationVersion).toBe(2);
  });

  it("returns structured mutation/query results for runtime integration surfaces", async () => {
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
      instanceId: "dataset-instance:mutation-contract",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const created = await service.mutateImageRecordInInstance({
      operation: "create",
      request: {
        systemId: "system:image-pipeline",
        instanceId: instance.instanceId,
        recordId: "record:mutation-1",
        record: {
          assetRef: { assetId: "asset:image:mutation-1" },
          width: 320,
          height: 240,
          format: "png",
          tags: ["seed"],
        },
      },
    });
    expect(created.accepted).toBeTrue();
    expect(created.record?.recordId).toBe("record:mutation-1");

    const updated = await service.mutateImageRecordInInstance({
      operation: "update",
      request: {
        systemId: "system:image-pipeline",
        instanceId: instance.instanceId,
        recordId: "record:mutation-1",
        patch: {
          imagePatch: {
            tagsPatch: {
              add: ["hero"],
            },
          },
        },
      },
    });
    expect(updated.accepted).toBeTrue();
    expect(updated.record?.image.tags).toEqual(["seed", "hero"]);

    const queryResult = service.queryImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      query: {
        tagsAll: ["hero"],
      },
    });
    expect(queryResult.totalCount).toBe(1);
    expect(queryResult.items[0]?.recordId).toBe("record:mutation-1");

    const deleted = await service.mutateImageRecordInInstance({
      operation: "delete",
      request: {
        systemId: "system:image-pipeline",
        instanceId: instance.instanceId,
        recordId: "record:mutation-1",
      },
    });
    expect(deleted.accepted).toBeTrue();
    expect(deleted.deletedRecordId).toBe("record:mutation-1");

    const missingDelete = await service.mutateImageRecordInInstance({
      operation: "delete",
      request: {
        systemId: "system:image-pipeline",
        instanceId: instance.instanceId,
        recordId: "record:missing",
      },
    });
    expect(missingDelete.accepted).toBeFalse();
    expect(missingDelete.issues[0]?.code).toBe("not-found");
  });

  it("supports batch get and delete/remove operations for runtime instance image records", async () => {
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
      instanceId: "dataset-instance:batch-and-delete",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          recordId: "record:batch-1",
          record: {
            assetRef: { assetId: "asset:image:batch-1" },
            width: 400,
            height: 300,
            format: "png",
          },
        },
        {
          recordId: "record:batch-2",
          record: {
            assetRef: { assetId: "asset:image:batch-2" },
            width: 500,
            height: 400,
            format: "jpeg",
          },
        },
      ]),
    });

    const selected = service.getImageRecordsFromInstanceByIds({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordIds: ["record:batch-1", "missing", "record:batch-2", "record:batch-2"],
    });
    expect(selected.map((entry) => entry.recordId)).toEqual(["record:batch-1", "record:batch-2"]);

    const removedOne = await service.deleteImageRecordFromInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:batch-1",
    });
    expect(removedOne).toBeTrue();

    const removedRemaining = await service.deleteAllImageRecordsFromInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(removedRemaining.instanceId).toBe(instance.instanceId);
    expect(removedRemaining.removedCount).toBe(1);
  });

  it("rejects invalid image record mutation through centralized instance schema enforcement", async () => {
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
      {
        mediaRecordValidator: new BlockedTagMediaRecordValidator(),
      },
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:mutate-reject",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:reject-1",
      record: {
        assetRef: { assetId: "asset:image:reject-1" },
        width: 800,
        height: 600,
        format: "png",
        tags: ["safe"],
      },
    });

    await expect(service.updateImageRecordInInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      recordId: "record:reject-1",
      patch: {
        imagePatch: {
          tags: ["safe", "blocked-tag"],
        },
      },
    })).rejects.toThrow("rejected record admission");
  });

  it("enforces dataset-instance lifecycle operations for load/reset/archive/delete with ownership checks", async () => {
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
      new AllowListSystemValidator(["system:image-pipeline", "system:other"]),
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:lifecycle",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
      seedMetadata: { bucket: "incoming" },
    });

    await service.ingestImageRecordsIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      records: Object.freeze([
        {
          recordId: "record:lifecycle-1",
          record: {
            assetRef: { assetId: "asset:image:lifecycle-1" },
            width: 512,
            height: 512,
            format: "png",
          },
        },
        {
          recordId: "record:lifecycle-2",
          record: {
            assetRef: { assetId: "asset:image:lifecycle-2" },
            width: 256,
            height: 256,
            format: "png",
          },
        },
      ]),
    });

    const loaded = service.loadDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(loaded.datasetAssetId).toBe("image-ingestor-v1");

    expect(() => service.loadDatasetInstance({
      systemId: "system:other",
      instanceId: instance.instanceId,
    })).toThrow("is not bound to system/subsystem 'system:other'");

    const reset = await service.resetDatasetInstanceState({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      clearSeedMetadata: true,
    });
    expect(reset.clearedImageRecordCount).toBe(2);
    expect(reset.instance.runtimeStatus).toBe("idle");
    expect(reset.instance.datasetAssetId).toBe("image-ingestor-v1");
    expect(reset.instance.seedMetadata).toBeUndefined();
    expect(service.listImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    }).length).toBe(0);

    const archived = await service.archiveDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      cleanupStatus: "pending",
    });
    expect(archived.lifecycleStatus).toBe("archived");
    expect(archived.runtimeStatus).toBe("unavailable");
    expect(archived.lifecycleMetadata?.cleanupStatus).toBe("pending");

    const archivedCleanupCompleted = await service.archiveDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      cleanupStatus: "completed",
    });
    expect(archivedCleanupCompleted.lifecycleStatus).toBe("archived");
    expect(archivedCleanupCompleted.lifecycleMetadata?.cleanupStatus).toBe("completed");

    await expect(service.ingestImageRecordIntoInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:lifecycle-3" },
        width: 512,
        height: 512,
        format: "png",
      },
    })).rejects.toThrow("Cannot ingest image record for archived dataset instance");

    const removed = await service.deleteDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(removed.instanceId).toBe(instance.instanceId);
    expect(service.getDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    })).toBeUndefined();
  });

  it("rejects dataset-instance deletion before archive unless force delete is explicitly requested", async () => {
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
      instanceId: "dataset-instance:delete-gate",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await expect(service.deleteDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    })).rejects.toThrow("must be archived before delete/remove");

    const forced = await service.deleteDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
      force: true,
    });
    expect(forced.instanceId).toBe(instance.instanceId);
    expect(service.getDatasetInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    })).toBeUndefined();
  });
  it("emits image-added events after successful image ingestion", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-ingest",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const record = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-ingest" },
        width: 640,
        height: 480,
        format: "png",
      },
    });

    const events = publisher.listPublishedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe(DatasetEventTypes.imageAdded);
    expect(events[0]?.payload.record.recordId).toBe(record.recordId);
  });

  it("emits generated-image events for generated output persistence", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );

    const instance = await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:event-generated",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: {
          kind: "generated-output",
          stableId: "generated-output:artifact://result-1.png",
          outputId: "artifact://result-1.png",
        },
        width: 512,
        height: 512,
        format: "png",
      },
      storageProvider: "generated-output",
      storageReference: "artifact://result-1.png",
      provenance: {
        sourceType: "generated-output",
        sourceRunId: "run-001",
      },
    });

    const events = publisher.listPublishedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe(DatasetEventTypes.imageGenerated);
    expect(events[0]?.payload.record.imageReference).toBe("artifact://result-1.png");
    expect(events[0]?.payloadMetadata?.workflowId).toBeUndefined();
    expect(events[0]?.payloadMetadata?.workflowRunId).toBe("run-001");
  });

  it("emits image-updated events with lineage metadata for image record updates", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );

    const instance = await service.ensureOutputImageStoreInstance({
      instanceId: "dataset-instance:event-update",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });
    const original = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-update" },
        width: 512,
        height: 512,
        format: "png",
        derived: { qualityScore: 0.83 },
      },
    });
    publisher.clear();

    const updated = await service.updateImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: original.recordId,
      lineageContext: {
        workflowAssetId: "workflow:image-upscale",
        workflowExecutionId: "execution:workflow-42",
        actorId: "workflow-runtime",
        source: "workflow-execution-output",
        studioId: "studio:image-manipulation",
      },
      patch: {
        imagePatch: {
          derived: { qualityScore: 0.95, sharpness: "high" },
        },
        metadataPatch: {
          set: { moderationState: "approved" },
        },
      },
    });

    expect(updated.image.derived.qualityScore).toBe(0.95);
    const events = publisher.listPublishedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe(DatasetEventTypes.imageUpdated);
    expect(events[0]?.actor.actorId).toBe("workflow-runtime");
    expect(events[0]?.actor.source).toBe("workflow-execution-output");
    expect(events[0]?.payload.updatedFields).toEqual(expect.arrayContaining(["image", "image.derived", "metadata"]));
    expect(events[0]?.payloadMetadata?.workflowId).toBe("workflow:image-upscale");
    expect(events[0]?.payloadMetadata?.workflowRunId).toBe("execution:workflow-42");
    expect(events[0]?.payloadMetadata?.lineage?.studioId).toBe("studio:image-manipulation");
    expect(events[0]?.payloadMetadata?.lineage?.instanceId).toBe(instance.instanceId);
    expect(events[0]?.payload.previousRecord?.recordId).toBe(original.recordId);
  });

  it("does not emit dataset events when record mutation fails", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher, mediaRecordValidator: new BlockedTagMediaRecordValidator() },
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-failed",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await expect(service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-failed" },
        width: 640,
        height: 480,
        format: "png",
        tags: ["blocked-tag"],
      },
    })).rejects.toThrow("media-tag-blocked");

    expect(publisher.listPublishedEvents()).toHaveLength(0);
  });

  it("does not emit dataset events when update mutation fails", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );
    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-failed-update",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    await expect(service.updateImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "record:missing",
      patch: { metadataPatch: { set: { note: "invalid" } } },
    })).rejects.toThrow("not found");

    expect(publisher.listPublishedEvents()).toHaveLength(0);
  });

  it("keeps authoritative record mutations when best-effort event publication fails", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const lineage = new InMemoryDatasetOperationalLineageSink();
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
      { datasetEventPublisher: new ThrowingDatasetEventPublisher() },
      lineage,
    );

    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-publish-failed",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });

    const created = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: "record:publish-failure",
      record: {
        assetRef: { assetId: "asset:image:event-publish-failure" },
        width: 640,
        height: 480,
        format: "png",
      },
    });

    const persisted = service.getImageRecordFromInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: created.recordId,
    });
    expect(persisted?.recordId).toBe(created.recordId);

    const diagnostics = lineage.listRecent();
    const failureEvent = diagnostics.find((entry) => entry.operation === "create-event-publish-failed");
    expect(failureEvent?.metadata?.datasetEventType).toBe(DatasetEventTypes.imageAdded);
    expect(failureEvent?.metadata?.datasetEventId).toBe(
      `dataset-event:${DatasetEventTypes.imageAdded}:${instance.systemId}:${instance.instanceId}:${created.recordId}:v1`,
    );
  });

  it("emits image-selected events when dataset selection meaningfully changes", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );
    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-selected",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });
    const first = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-select-1" },
        width: 320,
        height: 320,
        format: "png",
      },
    });
    const second = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-select-2" },
        width: 640,
        height: 640,
        format: "png",
      },
    });
    publisher.clear();

    const firstSelection = await service.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: first.recordId,
      selectionContext: {
        selectionMode: "single",
        reason: "canvas-focus",
        rank: 0,
      },
      lineageContext: {
        actorId: "workflow-user-1",
        source: "workflow-studio-canvas",
        studioId: "studio:workflow",
      },
    });
    const secondSelection = await service.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: second.recordId,
      selectionContext: {
        selectionMode: "single",
        reason: "next-image",
      },
    });

    expect(firstSelection.changed).toBeTrue();
    expect(secondSelection.changed).toBeTrue();
    const events = publisher.listPublishedEvents();
    expect(events).toHaveLength(2);
    expect(events[0]?.eventType).toBe(DatasetEventTypes.imageSelected);
    expect(events[0]?.payload.record.recordId).toBe(first.recordId);
    expect(events[0]?.actor.actorId).toBe("workflow-user-1");
    expect(events[0]?.actor.source).toBe("workflow-studio-canvas");
    expect(events[0]?.payload.selectionContext).toEqual({
      selectionMode: "single",
      reason: "canvas-focus",
      rank: 0,
    });
    expect(events[1]?.payload.record.recordId).toBe(second.recordId);
  });

  it("does not emit image-selected events for no-op selections", async () => {
    const repository = new InMemoryDatasetInstanceRepository();
    const publisher = new InMemoryDatasetEventPublisher();
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
      { datasetEventPublisher: publisher },
    );
    const instance = await service.ensureInputImageStoreInstance({
      instanceId: "dataset-instance:event-selected-noop",
      systemId: "system:image-pipeline",
      datasetAssetId: "image-ingestor-v1",
      datasetAssetVersionId: "1.0.0",
    });
    const record = await service.ingestImageRecordIntoInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      record: {
        assetRef: { assetId: "asset:image:event-select-noop" },
        width: 256,
        height: 256,
        format: "png",
      },
    });
    publisher.clear();

    const first = await service.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: record.recordId,
    });
    const second = await service.selectImageRecordInInstance({
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      recordId: record.recordId,
      selectionContext: {
        selectionMode: "single",
        reason: "still-focused",
      },
    });

    expect(first.changed).toBeTrue();
    expect(second.changed).toBeFalse();
    expect(publisher.listPublishedEvents()).toHaveLength(1);
  });

});

