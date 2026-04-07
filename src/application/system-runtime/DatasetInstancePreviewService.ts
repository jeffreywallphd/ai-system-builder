import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  createDatasetAssetReference,
  createDatasetInstanceReference,
  createDatasetRecordReference,
  type DatasetRecordReference,
} from "@domain/dataset-studio/contracts/StudioDatasetCompatibility";
import {
  deriveStorageReferenceFromImageRecord,
  type DatasetInstanceImageRecord,
  type DatasetInstanceImageRecordQuery,
} from "@domain/system-runtime/DatasetInstanceRecordDomain";
import type { DatasetInstance } from "@domain/system-runtime/DatasetInstanceDomain";
import type { DatasetOperationalLineageContext, DatasetOperationalLineageSink } from "./DatasetOperationalLineage";
import { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";

export interface ListDatasetInstancePreviewsRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly query?: DatasetInstanceImageRecordQuery;
  readonly limit?: number;
  readonly offset?: number;
  readonly lineageContext?: DatasetOperationalLineageContext;
}

export interface DatasetInstancePreviewSummary {
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
  readonly role: DatasetInstance["role"];
  readonly purpose?: string;
  readonly totalRecords: number;
  readonly returnedRecords: number;
  readonly truncated: boolean;
}

export interface DatasetInstanceImageRecordPreviewItem {
  readonly recordReference: DatasetRecordReference;
  readonly recordId: string;
  readonly selectionId: string;
  readonly imageReference?: string;
  readonly thumbnailReference?: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly tags: ReadonlyArray<string>;
  readonly metadataSummary: Readonly<Record<string, CanonicalRecordValue>>;
  readonly hasAnnotations: boolean;
  readonly hasDerived: boolean;
  readonly admittedAt: string;
  readonly updatedAt: string;
  readonly mutationVersion: number;
  readonly generation?: {
    readonly workflowRunId: string;
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
    readonly role: string;
    readonly outputIndex: number;
    readonly outputGroupId: string;
    readonly sourceImageStableId?: string;
  };
}

export interface DatasetInstancePreviewWindow {
  readonly offset: number;
  readonly limit: number;
  readonly returnedRecords: number;
  readonly hasPreviousWindow: boolean;
  readonly hasNextWindow: boolean;
}

export interface DatasetInstancePreviewInspection {
  readonly metadataFieldsPerItemLimit: number;
  readonly metadataFieldsTruncatedCount: number;
  readonly recordValidationWarnings: ReadonlyArray<string>;
  readonly payloadSizeBytes: number;
  readonly cache: {
    readonly enabled: boolean;
    readonly hit: boolean;
    readonly maxEntries: number;
  };
}

export interface DatasetInstanceImagePreviewList {
  readonly kind: "image-records";
  readonly summary: DatasetInstancePreviewSummary;
  readonly window: DatasetInstancePreviewWindow;
  readonly inspection: DatasetInstancePreviewInspection;
  readonly items: ReadonlyArray<DatasetInstanceImageRecordPreviewItem>;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 50;
  }
  if (!Number.isFinite(limit) || Math.floor(limit) !== limit) {
    throw new Error("invalid-request:limit must be an integer.");
  }
  if (limit <= 0 || limit > 500) {
    throw new Error("invalid-request:limit must be between 1 and 500.");
  }
  return limit;
}

function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined) {
    return 0;
  }
  if (!Number.isFinite(offset) || Math.floor(offset) !== offset) {
    throw new Error("invalid-request:offset must be an integer.");
  }
  if (offset < 0) {
    throw new Error("invalid-request:offset must be greater than or equal to 0.");
  }
  return offset;
}

function pickMetadataSummary(
  metadata: Readonly<Record<string, CanonicalRecordValue>>,
): {
  readonly metadataSummary: Readonly<Record<string, CanonicalRecordValue>>;
  readonly isTruncated: boolean;
} {
  const keys = Object.keys(metadata)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 8);
  return Object.freeze({
    metadataSummary: Object.freeze(Object.fromEntries(keys.map((key) => [key, metadata[key]]))),
    isTruncated: Object.keys(metadata).length > keys.length,
  });
}

function toImageReference(record: DatasetInstanceImageRecord): string | undefined {
  return deriveStorageReferenceFromImageRecord(record.image);
}

function toThumbnailReference(record: DatasetInstanceImageRecord): string | undefined {
  return record.storage?.reference ?? toImageReference(record);
}

function toPreviewItem(input: {
  readonly record: DatasetInstanceImageRecord;
  readonly systemId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly datasetAssetVersionId?: string;
}): {
  readonly item: DatasetInstanceImageRecordPreviewItem;
  readonly metadataWasTruncated: boolean;
  readonly validationWarnings: ReadonlyArray<string>;
} {
  const metadata = pickMetadataSummary(input.record.image.metadata);
  const dataset = createDatasetAssetReference({
    assetId: input.datasetAssetId,
    versionId: input.datasetAssetVersionId,
  });
  const instanceReference = createDatasetInstanceReference({
    systemId: input.systemId,
    instanceId: input.instanceId,
    dataset,
  });
  const validationWarnings: string[] = [];
  if (input.record.image.width <= 0 || input.record.image.height <= 0) {
    validationWarnings.push(`Record '${input.record.recordId}' has non-positive image dimensions.`);
  }
  if (!input.record.image.format.trim()) {
    validationWarnings.push(`Record '${input.record.recordId}' has an empty image format.`);
  }

  return Object.freeze({
    item: Object.freeze({
      recordReference: createDatasetRecordReference({
        dataset,
        selectionId: input.record.recordId,
        recordId: input.record.recordId,
        instance: instanceReference,
        imageReference: toImageReference(input.record),
      }),
      recordId: input.record.recordId,
      selectionId: input.record.recordId,
      imageReference: toImageReference(input.record),
      thumbnailReference: toThumbnailReference(input.record),
      width: input.record.image.width,
      height: input.record.image.height,
      format: input.record.image.format,
      tags: input.record.image.tags,
      metadataSummary: metadata.metadataSummary,
      hasAnnotations: Boolean(input.record.image.annotations && Object.keys(input.record.image.annotations).length > 0),
      hasDerived: Boolean(input.record.image.derived && Object.keys(input.record.image.derived).length > 0),
      admittedAt: input.record.admittedAt,
      updatedAt: input.record.updatedAt,
      mutationVersion: input.record.mutationVersion,
      generation: input.record.generation
        ? Object.freeze({
          workflowRunId: input.record.generation.runId,
          workflowAssetId: input.record.generation.workflowAssetId,
          workflowAssetVersionId: input.record.generation.workflowAssetVersionId,
          role: input.record.generation.role,
          outputIndex: input.record.generation.outputIndex ?? 0,
          outputGroupId: input.record.generation.outputGroupId ?? `run:${input.record.generation.runId}`,
          sourceImageStableId: input.record.generation.sourceImageRef?.stableId,
        })
        : undefined,
    }),
    metadataWasTruncated: metadata.isTruncated,
    validationWarnings: Object.freeze(validationWarnings),
  });
}

export class DatasetInstancePreviewService {
  private readonly previewCache = new Map<string, DatasetInstanceImagePreviewList>();
  private readonly maxCacheEntries: number;

  public constructor(
    private readonly datasetInstanceService: SystemDatasetInstanceService,
    private readonly lineageSink?: DatasetOperationalLineageSink,
    options?: {
      readonly maxCacheEntries?: number;
    },
  ) {
    this.maxCacheEntries = normalizeCacheSize(options?.maxCacheEntries);
  }

  public listImageRecordPreviews(request: ListDatasetInstancePreviewsRequest): DatasetInstanceImagePreviewList {
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const cacheKey = this.createCacheKey({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
      offset,
      limit,
    });
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      const withCacheHitInspection = this.withCacheInspection(cached, true);
      this.recordPreviewLineage(withCacheHitInspection, request.lineageContext, true);
      return withCacheHitInspection;
    }

    const instance = this.datasetInstanceService.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const recordsPage = this.datasetInstanceService.listImageRecordPageForInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
      limit,
      offset,
      lineageContext: request.lineageContext,
    });
    const mappedItems = recordsPage.items.map((record) => toPreviewItem({
      record,
      systemId: instance.systemId,
      instanceId: instance.instanceId,
      datasetAssetId: instance.datasetAssetId,
      datasetAssetVersionId: instance.datasetAssetVersionId,
    }));
    const previewItems = Object.freeze(mappedItems.map((entry) => entry.item));
    const validationWarnings = Object.freeze(mappedItems.flatMap((entry) => entry.validationWarnings));
    const metadataFieldsTruncatedCount = mappedItems.filter((entry) => entry.metadataWasTruncated).length;
    const payloadSizeBytes = JSON.stringify(previewItems).length;
    const preview = Object.freeze({
      kind: "image-records",
      summary: Object.freeze({
        systemId: instance.systemId,
        instanceId: instance.instanceId,
        datasetAssetId: instance.datasetAssetId,
        datasetAssetVersionId: instance.datasetAssetVersionId,
        role: instance.role,
        purpose: instance.purpose,
        totalRecords: recordsPage.totalCount,
        returnedRecords: previewItems.length,
        truncated: offset + previewItems.length < recordsPage.totalCount,
      }),
      window: Object.freeze({
        offset,
        limit,
        returnedRecords: previewItems.length,
        hasPreviousWindow: offset > 0,
        hasNextWindow: offset + previewItems.length < recordsPage.totalCount,
      }),
      inspection: Object.freeze({
        metadataFieldsPerItemLimit: 8,
        metadataFieldsTruncatedCount,
        recordValidationWarnings: validationWarnings,
        payloadSizeBytes,
        cache: Object.freeze({
          enabled: this.maxCacheEntries > 0,
          hit: false,
          maxEntries: this.maxCacheEntries,
        }),
      }),
      items: previewItems,
    });
    this.saveToCache(cacheKey, preview);
    this.recordPreviewLineage(preview, request.lineageContext, false);
    return preview;
  }

  private createCacheKey(input: {
    readonly systemId: string;
    readonly instanceId: string;
    readonly query?: DatasetInstanceImageRecordQuery;
    readonly offset: number;
    readonly limit: number;
  }): string {
    return JSON.stringify({
      systemId: input.systemId,
      instanceId: input.instanceId,
      offset: input.offset,
      limit: input.limit,
      query: input.query ?? null,
    });
  }

  private saveToCache(key: string, preview: DatasetInstanceImagePreviewList): void {
    if (this.maxCacheEntries <= 0) {
      return;
    }
    if (this.previewCache.has(key)) {
      this.previewCache.delete(key);
    }
    this.previewCache.set(key, preview);
    while (this.previewCache.size > this.maxCacheEntries) {
      const oldestKey = this.previewCache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.previewCache.delete(oldestKey);
    }
  }

  private withCacheInspection(preview: DatasetInstanceImagePreviewList, hit: boolean): DatasetInstanceImagePreviewList {
    return Object.freeze({
      ...preview,
      inspection: Object.freeze({
        ...preview.inspection,
        cache: Object.freeze({
          ...preview.inspection.cache,
          hit,
        }),
      }),
    });
  }

  private recordPreviewLineage(
    preview: DatasetInstanceImagePreviewList,
    context: DatasetOperationalLineageContext | undefined,
    wasCacheHit: boolean,
  ): void {
    this.lineageSink?.record({
      eventKind: "preview-access",
      systemId: preview.summary.systemId,
      instanceId: preview.summary.instanceId,
      datasetAssetId: preview.summary.datasetAssetId,
      datasetAssetVersionId: preview.summary.datasetAssetVersionId,
      operation: "list-image-record-previews",
      resultCount: preview.window.returnedRecords,
      context,
      metadata: Object.freeze({
        offset: String(preview.window.offset),
        limit: String(preview.window.limit),
        totalCount: String(preview.summary.totalRecords),
        payloadSizeBytes: String(preview.inspection.payloadSizeBytes),
        cacheHit: wasCacheHit ? "true" : "false",
      }),
    });
  }
}

function normalizeCacheSize(value: number | undefined): number {
  if (value === undefined) {
    return 40;
  }
  if (!Number.isFinite(value) || Math.floor(value) !== value || value < 0 || value > 500) {
    throw new Error("invalid-request:maxCacheEntries must be an integer between 0 and 500.");
  }
  return value;
}

