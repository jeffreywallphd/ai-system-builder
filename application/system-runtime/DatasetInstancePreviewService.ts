import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  deriveStorageReferenceFromImageRecord,
  type DatasetInstanceImageRecord,
  type DatasetInstanceImageRecordQuery,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { DatasetInstance } from "../../domain/system-runtime/DatasetInstanceDomain";
import { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";

export interface ListDatasetInstancePreviewsRequest {
  readonly systemId: string;
  readonly instanceId: string;
  readonly query?: DatasetInstanceImageRecordQuery;
  readonly limit?: number;
  readonly offset?: number;
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

function toPreviewItem(record: DatasetInstanceImageRecord): {
  readonly item: DatasetInstanceImageRecordPreviewItem;
  readonly metadataWasTruncated: boolean;
  readonly validationWarnings: ReadonlyArray<string>;
} {
  const metadata = pickMetadataSummary(record.image.metadata);
  const validationWarnings: string[] = [];
  if (record.image.width <= 0 || record.image.height <= 0) {
    validationWarnings.push(`Record '${record.recordId}' has non-positive image dimensions.`);
  }
  if (!record.image.format.trim()) {
    validationWarnings.push(`Record '${record.recordId}' has an empty image format.`);
  }

  return Object.freeze({
    item: Object.freeze({
      recordId: record.recordId,
      selectionId: record.recordId,
      imageReference: toImageReference(record),
      thumbnailReference: toThumbnailReference(record),
      width: record.image.width,
      height: record.image.height,
      format: record.image.format,
      tags: record.image.tags,
      metadataSummary: metadata.metadataSummary,
      hasAnnotations: Boolean(record.image.annotations && Object.keys(record.image.annotations).length > 0),
      hasDerived: Boolean(record.image.derived && Object.keys(record.image.derived).length > 0),
      admittedAt: record.admittedAt,
      updatedAt: record.updatedAt,
      mutationVersion: record.mutationVersion,
    }),
    metadataWasTruncated: metadata.isTruncated,
    validationWarnings: Object.freeze(validationWarnings),
  });
}

export class DatasetInstancePreviewService {
  public constructor(private readonly datasetInstanceService: SystemDatasetInstanceService) {}

  public listImageRecordPreviews(request: ListDatasetInstancePreviewsRequest): DatasetInstanceImagePreviewList {
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const instance = this.datasetInstanceService.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const records = this.datasetInstanceService.listImageRecordsForInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
    });
    const windowedRecords = records.slice(offset, offset + limit);
    const mappedItems = windowedRecords.map(toPreviewItem);
    const previewItems = Object.freeze(mappedItems.map((entry) => entry.item));
    const validationWarnings = Object.freeze(mappedItems.flatMap((entry) => entry.validationWarnings));
    const metadataFieldsTruncatedCount = mappedItems.filter((entry) => entry.metadataWasTruncated).length;
    return Object.freeze({
      kind: "image-records",
      summary: Object.freeze({
        systemId: instance.systemId,
        instanceId: instance.instanceId,
        datasetAssetId: instance.datasetAssetId,
        datasetAssetVersionId: instance.datasetAssetVersionId,
        role: instance.role,
        purpose: instance.purpose,
        totalRecords: records.length,
        returnedRecords: previewItems.length,
        truncated: offset + previewItems.length < records.length,
      }),
      window: Object.freeze({
        offset,
        limit,
        returnedRecords: previewItems.length,
        hasPreviousWindow: offset > 0,
        hasNextWindow: offset + previewItems.length < records.length,
      }),
      inspection: Object.freeze({
        metadataFieldsPerItemLimit: 8,
        metadataFieldsTruncatedCount,
        recordValidationWarnings: validationWarnings,
      }),
      items: previewItems,
    });
  }
}
