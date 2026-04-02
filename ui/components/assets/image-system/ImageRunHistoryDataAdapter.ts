import type { ImageRunHistoryListing } from "../../../../application/system-runtime/ImageRunHistoryDataContract";
import type { ImageRunHistoryItemViewModel } from "./ImageUiContracts";

function summarizeRecord(record: ImageRunHistoryListing["runs"][number]): ImageRunHistoryItemViewModel {
  const outputCount = record.outputs.datasetInstance?.persistedRecordIds.length ?? record.outputs.images.length;
  return Object.freeze({
    runId: record.runId,
    status: record.status,
    timestamp: record.timestamps.updatedAt,
    workflowSummary: record.workflow.workflowAssetVersionId
      ? `${record.workflow.workflowAssetId} @ ${record.workflow.workflowAssetVersionId}`
      : record.workflow.workflowAssetId,
    ioSummary: `${record.inputs.images.length} input / ${outputCount} output`,
    parameterSummary: record.inputs.parameterSummary,
  });
}

export function mapImageRunHistoryListingToViewModels(listing: ImageRunHistoryListing): ReadonlyArray<ImageRunHistoryItemViewModel> {
  return Object.freeze(listing.runs.map((record) => summarizeRecord(record)));
}
