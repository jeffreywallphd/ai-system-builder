import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetSchemaIntentIds,
  type DatasetSchemaIntentId,
} from "../../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { IImageMetadataExtractor } from "../../../domain/dataset-studio/interfaces/ImageMetadataExtraction";
import type { ImageRecord } from "../../../domain/dataset-studio/contracts/ImageRecord";
import {
  createMediaValidationIssue,
  createMediaValidationResult,
  type IMediaRecordValidator,
} from "../../../domain/dataset-studio/interfaces/MediaValidation";
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
    })).rejects.toThrow("is owned by system 'system:image-pipeline'");

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

    const listed = service.listImageRecordsForInstance({
      systemId: "system:image-pipeline",
      instanceId: instance.instanceId,
    });
    expect(listed.length).toBe(1);
    expect(listed[0]?.recordId).toBe("record:image-1");
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
    })).toThrow("is owned by system 'system:image-pipeline'");
  });

  it("lists and queries ingested records by simple metadata fields", async () => {
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
            tags: ["featured", "hero"],
            metadata: { source: "camera-a" },
          },
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
        tag: "hero",
        minWidth: 800,
        metadata: {
          source: "camera-a",
        },
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
          tags: ["seed", "hero"],
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
    })).toThrow("is owned by system 'system:image-pipeline'");

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
    expect(service.getDatasetInstance(instance.instanceId)).toBeUndefined();
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
    expect(service.getDatasetInstance(instance.instanceId)).toBeUndefined();
  });
});
