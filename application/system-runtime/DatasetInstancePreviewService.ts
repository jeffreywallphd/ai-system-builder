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
  readonly imageReference?: string;
  readonly previewReference?: string;
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

export interface DatasetInstanceImagePreviewList {
  readonly kind: "image-records";
  readonly summary: DatasetInstancePreviewSummary;
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

function pickMetadataSummary(metadata: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  const keys = Object.keys(metadata)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 8);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, metadata[key]])));
}

function toImageReference(record: DatasetInstanceImageRecord): string | undefined {
  return deriveStorageReferenceFromImageRecord(record.image);
}

function toPreviewReference(record: DatasetInstanceImageRecord): string | undefined {
  return record.storage?.reference ?? toImageReference(record);
}

function toPreviewItem(record: DatasetInstanceImageRecord): DatasetInstanceImageRecordPreviewItem {
  return Object.freeze({
    recordId: record.recordId,
    imageReference: toImageReference(record),
    previewReference: toPreviewReference(record),
    width: record.image.width,
    height: record.image.height,
    format: record.image.format,
    tags: record.image.tags,
    metadataSummary: pickMetadataSummary(record.image.metadata),
    hasAnnotations: Boolean(record.image.annotations && Object.keys(record.image.annotations).length > 0),
    hasDerived: Boolean(record.image.derived && Object.keys(record.image.derived).length > 0),
    admittedAt: record.admittedAt,
    updatedAt: record.updatedAt,
    mutationVersion: record.mutationVersion,
  });
}

export class DatasetInstancePreviewService {
  public constructor(private readonly datasetInstanceService: SystemDatasetInstanceService) {}

  public listImageRecordPreviews(request: ListDatasetInstancePreviewsRequest): DatasetInstanceImagePreviewList {
    const limit = normalizeLimit(request.limit);
    const instance = this.datasetInstanceService.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
    });
    const records = this.datasetInstanceService.listImageRecordsForInstance({
      systemId: request.systemId,
      instanceId: request.instanceId,
      query: request.query,
    });
    const previewItems = Object.freeze(records.slice(0, limit).map(toPreviewItem));
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
        truncated: previewItems.length < records.length,
      }),
      items: previewItems,
    });
  }
}

