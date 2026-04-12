import type { ImageRunHistoryRecord } from "@application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryItem } from "@application/system-runtime/OutputGalleryDataContract";
import type {
  GetGeneratedResultApiResponse,
  GetGeneratedResultLineageDetailApiResponse,
  ListGeneratedResultsApiResponse,
  RequestGeneratedResultPreviewApiResponse,
} from "@infrastructure/api/generated-results/sdk/PublicGeneratedResultManagementApiContract";

function normalizeImageFormat(mediaType: string | undefined): string {
  if (mediaType === "image/png") {
    return "png";
  }
  if (mediaType === "image/jpeg") {
    return "jpeg";
  }
  if (mediaType === "image/webp") {
    return "webp";
  }
  return "webp";
}

export function buildGeneratedResultPreviewContentUrl(input: {
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly preview?: RequestGeneratedResultPreviewApiResponse["preview"];
}): string | undefined {
  const endpoint = input.preview?.selected?.contentEndpoint?.trim();
  const token = input.preview?.selected?.previewToken?.trim();
  if (!endpoint || !token) {
    return undefined;
  }
  const delimiter = endpoint.includes("?") ? "&" : "?";
  return `${input.baseUrl}${endpoint}${delimiter}workspaceId=${encodeURIComponent(input.workspaceId)}&previewToken=${encodeURIComponent(token)}`;
}

export function mapGeneratedResultToOutputGalleryItem(input: {
  readonly summary: ListGeneratedResultsApiResponse["items"][number];
  readonly previewUrl?: string;
  readonly detail?: GetGeneratedResultApiResponse["result"];
  readonly lineageDetail?: GetGeneratedResultLineageDetailApiResponse["lineage"];
}): OutputGalleryItem {
  const width = input.detail?.previewDescriptors[0]?.width
    ?? (input.previewUrl ? 1024 : 1);
  const height = input.detail?.previewDescriptors[0]?.height
    ?? (input.previewUrl ? 1024 : 1);
  const firstInputAssetId = input.lineageDetail?.upstreamInputs[0]?.assetId;
  return Object.freeze({
    itemId: input.summary.resultAssetId,
    image: Object.freeze({
      recordId: input.summary.resultAssetId,
      selectionId: input.summary.resultAssetId,
      imageReference: input.previewUrl,
      thumbnailReference: input.previewUrl,
      width,
      height,
      format: normalizeImageFormat(input.summary.mediaType),
      mimeType: input.summary.mediaType,
    }),
    dataset: Object.freeze({
      systemId: input.summary.systemId,
      instanceId: `generated-results:${input.summary.workflowId}`,
      datasetAssetId: "generated-result-gallery",
      role: "output-image-dataset",
      purpose: "generated-results",
    }),
    workflow: Object.freeze({
      workflowRunId: input.summary.runId,
      workflowAssetId: input.summary.workflowId,
      workflowAssetVersionId: input.detail?.lineageDetail.workflowTemplateVersionId,
      generationRole: input.summary.outputSlot,
    }),
    sourceImage: firstInputAssetId
      ? Object.freeze({
        stableId: firstInputAssetId,
        assetId: firstInputAssetId,
      })
      : undefined,
    timestamps: Object.freeze({
      admittedAt: input.summary.createdAt,
      updatedAt: input.summary.updatedAt,
    }),
    generationParametersSummary: Object.freeze({
      resultStatus: input.summary.status,
      previewState: input.summary.preview.state,
      retrievalState: input.summary.retrieval.state,
      runId: input.summary.runId,
      outputSlot: input.summary.outputSlot,
    }),
    imageMetadataSummary: Object.freeze({
      metadata: Object.freeze({
        lineageInputAssetCount: input.summary.lineage.inputAssetCount,
      }),
      hasAnnotations: false,
      hasDerived: false,
    }),
    tags: Object.freeze([
      "generated-result",
      input.summary.status,
      input.summary.preview.state,
    ]),
    derivedAttributes: Object.freeze({
      resultAssetId: input.summary.resultAssetId,
      runId: input.summary.runId,
    }),
  });
}

export function mapGeneratedResultsToRunHistory(
  items: ReadonlyArray<ListGeneratedResultsApiResponse["items"][number]>,
): ReadonlyArray<ImageRunHistoryRecord> {
  const byRunId = new Map<string, Array<ListGeneratedResultsApiResponse["items"][number]>>();
  for (const item of items) {
    const group = byRunId.get(item.runId) ?? [];
    group.push(item);
    byRunId.set(item.runId, group);
  }

  const runs = [...byRunId.entries()].map(([runId, results]) => {
    const sorted = [...results].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const latest = sorted[0]!;
    const statuses = new Set(results.map((result) => result.status));
    const status: ImageRunHistoryRecord["status"] = statuses.has("pending-collection")
      ? "running"
      : statuses.has("failed-collection")
        ? (statuses.has("available") || statuses.has("preview-ready") ? "partial" : "failed")
        : "completed";

    const outputRecordIds = Object.freeze(results.map((result) => result.resultAssetId));
    return Object.freeze({
      runId,
      workflowExecutionId: runId,
      system: Object.freeze({
        systemId: latest.systemId,
      }),
      workflow: Object.freeze({
        workflowAssetId: latest.workflowId,
        workflowAssetVersionId: undefined,
      }),
      inputs: Object.freeze({
        parameterSummary: Object.freeze({
          outputCount: results.length,
        }),
        images: Object.freeze([]),
      }),
      outputs: Object.freeze({
        images: Object.freeze(results.map((result) => Object.freeze({
          recordId: result.resultAssetId,
          assetId: result.resultAssetId,
          outputId: result.outputSlot,
        }))),
      }),
      status,
      lineage: Object.freeze({
        outputRecordIds,
        workflowAssetId: latest.workflowId,
      }),
      timestamps: Object.freeze({
        requestedAt: [...results].sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]!.createdAt,
        completedAt: latest.updatedAt,
        updatedAt: latest.updatedAt,
      }),
    });
  });

  return Object.freeze(runs.sort((left, right) => right.timestamps.updatedAt.localeCompare(left.timestamps.updatedAt)));
}
