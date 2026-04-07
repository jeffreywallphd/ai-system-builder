import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type { OutputGalleryItem } from "./OutputGalleryDataContract";
import { OutputGalleryDatasetIntegrationService } from "./OutputGalleryDatasetIntegrationService";
import {
  ImageRunHistoryExecutionStatuses,
  type ImageRunHistoryExecutionStatus,
  type ImageRunHistoryListing,
  type ImageRunHistoryRecord,
  validateImageRunHistoryListing,
  validateImageRunHistoryRecord,
} from "./ImageRunHistoryDataContract";
import type { ImageRunHistoryRepository } from "./ImageRunHistoryRepository";
import { buildImageRunLineageView, type ImageRunLineageView } from "./ImageRunLineageDataContract";

export interface RecordImageRunHistoryRequest {
  readonly runId: string;
  readonly workflowExecutionId?: string;
  readonly systemId: string;
  readonly workflowAssetId: string;
  readonly workflowAssetVersionId?: string;
  readonly inputImages?: ReadonlyArray<ImageRunHistoryRecord["inputs"]["images"][number]>;
  readonly outputImages?: ReadonlyArray<ImageRunHistoryRecord["outputs"]["images"][number]>;
  readonly outputDatasetInstance?: ImageRunHistoryRecord["outputs"]["datasetInstance"];
  readonly parameterSummary?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly status: ImageRunHistoryExecutionStatus;
  readonly lineage?: ImageRunHistoryRecord["lineage"];
  readonly timestamps?: {
    readonly requestedAt?: string;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly updatedAt?: string;
  };
}

export interface ListImageRunHistoryRequest {
  readonly systemId: string;
  readonly workflowAssetId?: string;
  readonly status?: ImageRunHistoryExecutionStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetImageRunWithOutputsRequest {
  readonly systemId: string;
  readonly runId: string;
  readonly outputLimit?: number;
}

export interface ListImageRunHistoryWithOutputsRequest extends ListImageRunHistoryRequest {
  readonly outputLimitPerRun?: number;
}

export interface ImageRunHistoryWithOutputs {
  readonly run: ImageRunHistoryRecord;
  readonly linkedOutputs: ReadonlyArray<OutputGalleryItem>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`invalid-request:${label} is required.`);
  }
  return normalized;
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

function normalizeSummary(input?: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
  if (!input) {
    return Object.freeze({});
  }
  const keys = Object.keys(input).sort((left, right) => left.localeCompare(right)).slice(0, 20);
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, input[key]])));
}

function deriveStatus(input: {
  readonly status: ImageRunHistoryExecutionStatus;
  readonly outputDatasetInstance?: RecordImageRunHistoryRequest["outputDatasetInstance"];
}): ImageRunHistoryExecutionStatus {
  if (input.status === ImageRunHistoryExecutionStatuses.completed
    && input.outputDatasetInstance
    && input.outputDatasetInstance.persistedRecordIds.length === 0) {
    return ImageRunHistoryExecutionStatuses.partial;
  }
  return input.status;
}

export class ImageRunHistoryService {
  public constructor(
    private readonly repository: ImageRunHistoryRepository,
    private readonly outputGalleryService: OutputGalleryDatasetIntegrationService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public recordRun(request: RecordImageRunHistoryRequest): ImageRunHistoryRecord {
    const nowIso = this.now().toISOString();
    const record = validateImageRunHistoryRecord({
      runId: normalizeRequired(request.runId, "runId"),
      workflowExecutionId: request.workflowExecutionId?.trim(),
      system: {
        systemId: normalizeRequired(request.systemId, "systemId"),
      },
      workflow: {
        workflowAssetId: normalizeRequired(request.workflowAssetId, "workflowAssetId"),
        workflowAssetVersionId: request.workflowAssetVersionId?.trim(),
      },
      inputs: {
        parameterSummary: normalizeSummary(request.parameterSummary),
        images: request.inputImages ?? [],
      },
      outputs: {
        datasetInstance: request.outputDatasetInstance,
        images: request.outputImages ?? [],
      },
      status: deriveStatus({
        status: request.status,
        outputDatasetInstance: request.outputDatasetInstance,
      }),
      lineage: request.lineage,
      timestamps: {
        requestedAt: request.timestamps?.requestedAt ?? nowIso,
        startedAt: request.timestamps?.startedAt,
        completedAt: request.timestamps?.completedAt,
        updatedAt: request.timestamps?.updatedAt ?? nowIso,
      },
    });

    return this.repository.save(record);
  }

  public listRuns(request: ListImageRunHistoryRequest): ImageRunHistoryListing {
    const limit = normalizeLimit(request.limit);
    const offset = normalizeOffset(request.offset);
    const systemId = normalizeRequired(request.systemId, "systemId");
    const queryResult = this.repository.list({
      systemId,
      workflowAssetId: request.workflowAssetId?.trim(),
      status: request.status,
      limit,
      offset,
    });

    return validateImageRunHistoryListing({
      kind: "image-run-history",
      summary: {
        systemId,
        totalRuns: queryResult.totalCount,
        returnedRuns: queryResult.records.length,
        truncated: offset + queryResult.records.length < queryResult.totalCount,
      },
      window: {
        offset,
        limit,
        hasPreviousWindow: offset > 0,
        hasNextWindow: offset + queryResult.records.length < queryResult.totalCount,
      },
      runs: queryResult.records,
    });
  }

  public listRunsWithLinkedOutputs(request: ListImageRunHistoryWithOutputsRequest): ReadonlyArray<ImageRunHistoryWithOutputs> {
    const listing = this.listRuns(request);
    const outputLimitPerRun = request.outputLimitPerRun ?? 100;
    return Object.freeze(listing.runs
      .map((run) => this.getRunWithLinkedOutputs({
        systemId: request.systemId,
        runId: run.runId,
        outputLimit: outputLimitPerRun,
      }))
      .filter((entry): entry is ImageRunHistoryWithOutputs => entry !== undefined));
  }


  public getRunLineage(request: GetImageRunWithOutputsRequest): ImageRunLineageView | undefined {
    const entry = this.getRunWithLinkedOutputs(request);
    if (!entry) {
      return undefined;
    }
    return buildImageRunLineageView(entry);
  }
  public getRunWithLinkedOutputs(request: GetImageRunWithOutputsRequest): ImageRunHistoryWithOutputs | undefined {
    const systemId = normalizeRequired(request.systemId, "systemId");
    const runId = normalizeRequired(request.runId, "runId");
    const found = this.repository.getBySystemAndRunId({ systemId, runId });
    if (!found) {
      return undefined;
    }

    const dataset = found.outputs.datasetInstance;
    if (!dataset) {
      return Object.freeze({ run: found, linkedOutputs: Object.freeze([]) });
    }

    const listing = this.outputGalleryService.listOutputGalleryItems({
      systemId,
      datasetInstanceId: dataset.instanceId,
      limit: request.outputLimit ?? 200,
      offset: 0,
    });

    const expectedRecordIds = new Set(dataset.persistedRecordIds);
    const linkedOutputs = listing.items
      .filter((item) => item.workflow?.workflowRunId === runId)
      .filter((item) => expectedRecordIds.size === 0 || expectedRecordIds.has(item.image.recordId));

    return Object.freeze({
      run: found,
      linkedOutputs: Object.freeze(linkedOutputs),
    });
  }
}

