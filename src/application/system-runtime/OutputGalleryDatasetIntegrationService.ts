import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  deriveStorageReferenceFromImageRecord,
  type DatasetInstanceImageRecord,
  type DatasetInstanceImageRecordQuery,
} from "@domain/system-runtime/DatasetInstanceRecordDomain";
import type { OutputGalleryItem, OutputGalleryListing } from "./OutputGalleryDataContract";
import { validateOutputGalleryListing } from "./OutputGalleryDataContract";
import { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";

export interface ListOutputGalleryItemsRequest {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly query?: DatasetInstanceImageRecordQuery;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetOutputGalleryItemRequest {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly recordId: string;
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

function summarizeParameters(value: CanonicalRecordValue | undefined): Readonly<Record<string, CanonicalRecordValue>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right)).slice(0, 12);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, (value as Record<string, CanonicalRecordValue>)[key]])));
}

function summarizeMetadata(metadata: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  const keys = Object.keys(metadata).sort((left, right) => left.localeCompare(right)).slice(0, 12);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, metadata[key]])));
}

function summarizeDerived(derived: Readonly<Record<string, CanonicalRecordValue>> | undefined): Readonly<Record<string, CanonicalRecordValue>> {
  if (!derived) {
    return Object.freeze({});
  }
  const keys = Object.keys(derived).sort((left, right) => left.localeCompare(right)).slice(0, 8);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, derived[key]])));
}

function toOutputGalleryItem(
  record: DatasetInstanceImageRecord,
  datasetContext: {
    readonly role: string;
    readonly purpose?: string;
  },
): OutputGalleryItem {
  const imageReference = deriveStorageReferenceFromImageRecord(record.image);
  const sourceRef = record.generation?.sourceImageRef;
  return Object.freeze({
    itemId: `${record.instanceId}:${record.recordId}:${record.mutationVersion}`,
    image: Object.freeze({
      recordId: record.recordId,
      selectionId: record.recordId,
      imageReference,
      thumbnailReference: record.storage?.reference ?? imageReference,
      width: record.image.width,
      height: record.image.height,
      format: record.image.format,
      mimeType: record.image.mimeType,
    }),
    dataset: Object.freeze({
      systemId: record.systemId,
      instanceId: record.instanceId,
      datasetAssetId: record.datasetAssetId,
      datasetAssetVersionId: record.datasetAssetVersionId,
      role: datasetContext.role,
      purpose: datasetContext.purpose,
    }),
    workflow: record.generation
      ? Object.freeze({
        workflowRunId: record.generation.runId,
        workflowAssetId: record.generation.workflowAssetId,
        workflowAssetVersionId: record.generation.workflowAssetVersionId,
        generationRole: record.generation.role,
        outputIndex: record.generation.outputIndex,
        outputGroupId: record.generation.outputGroupId,
      })
      : undefined,
    sourceImage: sourceRef
      ? Object.freeze({
        stableId: sourceRef.stableId,
        assetId: sourceRef.assetId,
        assetVersionId: sourceRef.assetVersionId,
        uri: sourceRef.uri,
        outputId: sourceRef.outputId,
      })
      : undefined,
    timestamps: Object.freeze({
      admittedAt: record.admittedAt,
      updatedAt: record.updatedAt,
    }),
    generationParametersSummary: summarizeParameters(record.generation?.metadata.parameterSnapshot ?? record.metadata.parameterSnapshot),
    imageMetadataSummary: Object.freeze({
      metadata: summarizeMetadata(record.image.metadata),
      hasAnnotations: Boolean(record.image.annotations && Object.keys(record.image.annotations).length > 0),
      hasDerived: Boolean(record.image.derived && Object.keys(record.image.derived).length > 0),
    }),
    tags: Object.freeze([...(record.image.tags ?? [])]),
    derivedAttributes: summarizeDerived(record.image.derived),
  });
}

export class OutputGalleryDatasetIntegrationService {
  public constructor(private readonly datasetInstances: SystemDatasetInstanceService) {}

  public getOutputGalleryItem(request: GetOutputGalleryItemRequest): OutputGalleryItem {
    const instance = this.datasetInstances.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.datasetInstanceId,
    });
    const record = this.datasetInstances.getImageRecordFromInstance({
      systemId: request.systemId,
      instanceId: request.datasetInstanceId,
      recordId: request.recordId,
    });
    if (!record) {
      throw new Error(`not-found:Image record '${request.recordId}' was not found in dataset instance '${request.datasetInstanceId}'.`);
    }
    return toOutputGalleryItem(record, {
      role: instance.role,
      purpose: instance.purpose,
    });
  }

  public listOutputGalleryItems(request: ListOutputGalleryItemsRequest): OutputGalleryListing {
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const instance = this.datasetInstances.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.datasetInstanceId,
    });
    const page = this.datasetInstances.listImageRecordPageForInstance({
      systemId: request.systemId,
      instanceId: request.datasetInstanceId,
      query: request.query,
      limit,
      offset,
    });

    const listing = Object.freeze({
      kind: "output-gallery-items",
      summary: Object.freeze({
        systemId: instance.systemId,
        datasetInstanceId: instance.instanceId,
        datasetAssetId: instance.datasetAssetId,
        datasetAssetVersionId: instance.datasetAssetVersionId,
        role: instance.role,
        purpose: instance.purpose,
        totalItems: page.totalCount,
        returnedItems: page.items.length,
        truncated: offset + page.items.length < page.totalCount,
      }),
      window: Object.freeze({
        offset,
        limit,
        hasPreviousWindow: offset > 0,
        hasNextWindow: offset + page.items.length < page.totalCount,
      }),
      items: Object.freeze(page.items.map((record) => toOutputGalleryItem(record, {
        role: instance.role,
        purpose: instance.purpose,
      }))),
    } satisfies OutputGalleryListing);

    return validateOutputGalleryListing(listing);
  }
}

