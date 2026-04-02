import type { JSX } from "react";
import type { ImageRunHistoryListing } from "../../../../application/system-runtime/ImageRunHistoryDataContract";
import type { OutputGalleryListing } from "../../../../application/system-runtime/OutputGalleryDataContract";
import { mapOutputGalleryListingToImageInterfaceState } from "./ImageOutputGalleryDataAdapter";
import { DEFAULT_IMAGE_RENDER_OPTIONS, type ImageCollectionPresentationMode } from "./ImageUiContracts";
import { ImageOutputGallery } from "./ImageOutputGallery";
import { mapImageRunHistoryListingToViewModels } from "./ImageRunHistoryDataAdapter";
import { ImageRunHistoryList } from "./ImageRunHistoryList";

export function ImageOutputGalleryAsset({ listing, mode = "grid" }: { readonly listing: OutputGalleryListing; readonly mode?: ImageCollectionPresentationMode }): JSX.Element {
  const mapped = mapOutputGalleryListingToImageInterfaceState(listing);
  return (
    <ImageOutputGallery
      items={mapped.imageCollection}
      datasetContext={mapped.datasetRef}
      renderOptions={DEFAULT_IMAGE_RENDER_OPTIONS}
      presentationMode={mode}
      title="Persisted output gallery"
    />
  );
}

export function ImageRunHistoryAsset({ listing }: { readonly listing: ImageRunHistoryListing }): JSX.Element {
  return <ImageRunHistoryList title="Persisted run history" runs={mapImageRunHistoryListingToViewModels(listing)} />;
}
