import type { OutputGalleryItem, OutputGalleryListing } from "../../../../application/system-runtime/OutputGalleryDataContract";
import type { ImageInterfaceState } from "./ImageSystemStateIntegration";
import type { ImageUiViewModel } from "./ImageUiContracts";

export function mapOutputGalleryItemToImageViewModel(item: OutputGalleryItem): ImageUiViewModel {
  return Object.freeze({
    imageId: item.image.recordId,
    title: item.workflow
      ? `${item.workflow.workflowAssetId} · ${item.workflow.workflowRunId}`
      : item.image.recordId,
    sourceUrl: item.image.imageReference,
    thumbnailUrl: item.image.thumbnailReference,
    metadata: Object.freeze({
      width: item.image.width,
      height: item.image.height,
      format: item.image.format,
      mimeType: item.image.mimeType,
      orientation: item.derivedAttributes.orientation === "landscape"
        || item.derivedAttributes.orientation === "portrait"
        || item.derivedAttributes.orientation === "square"
        ? item.derivedAttributes.orientation
        : undefined,
    }),
    tags: item.tags,
    context: Object.freeze({
      dataset: Object.freeze({
        datasetAssetId: item.dataset.datasetAssetId,
        datasetVersionId: item.dataset.datasetAssetVersionId,
        datasetInstanceId: item.dataset.instanceId,
      }),
      system: Object.freeze({
        systemAssetId: item.dataset.systemId,
      }),
      workflowAssetId: item.workflow?.workflowAssetId,
      workflowRunId: item.workflow?.workflowRunId,
    }),
  });
}

export function mapOutputGalleryListingToImageInterfaceState(listing: OutputGalleryListing): Pick<ImageInterfaceState, "imageCollection" | "datasetRef" | "systemRef"> {
  return Object.freeze({
    imageCollection: Object.freeze(listing.items.map((item) => mapOutputGalleryItemToImageViewModel(item))),
    datasetRef: Object.freeze({
      datasetAssetId: listing.summary.datasetAssetId,
      datasetVersionId: listing.summary.datasetAssetVersionId,
      datasetInstanceId: listing.summary.datasetInstanceId,
    }),
    systemRef: Object.freeze({
      systemAssetId: listing.summary.systemId,
    }),
  });
}
