import { useMemo, useState, type JSX } from "react";
import type {
  ImageCollectionPresentationMode,
  ImageOutputGalleryEventContract,
  ImageOutputGalleryPropsContract,
} from "./ImageUiContracts";
import { emitImageUiEvent } from "./ImageUiEventAdapters";
import { ImageOutputGalleryCollection } from "./ImageOutputGalleryCollection";

export interface ImageOutputGalleryProps extends ImageOutputGalleryPropsContract, ImageOutputGalleryEventContract {
  readonly title?: string;
  readonly className?: string;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
  readonly pageSize?: number;
  readonly presentationMode?: ImageCollectionPresentationMode;
}

export function ImageOutputGallery({
  items,
  selection,
  renderOptions,
  datasetContext,
  eventContext,
  onSelectionChanged,
  onItemOpened,
  onEvent,
  title = "Output gallery",
  className,
  loading = false,
  errorMessage,
  emptyMessage = "No images available.",
  pageSize = 12,
  presentationMode = "grid",
}: ImageOutputGalleryProps): JSX.Element {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  if (loading) {
    return <section className="ui-image-output-gallery ui-image-output-gallery--status ui-image-surface--status">{title}: Loading…</section>;
  }
  if (errorMessage) {
    return <section className="ui-image-output-gallery ui-image-output-gallery--status ui-image-surface--status ui-text-danger">{errorMessage}</section>;
  }
  if (items.length === 0) {
    return <section className="ui-image-output-gallery ui-image-output-gallery--status ui-image-surface--status">{emptyMessage}</section>;
  }

  return (
    <section className={["ui-image-output-gallery", "ui-image-surface", className ?? ""].filter(Boolean).join(" ")}>
      <header className="ui-image-output-gallery__header ui-image-surface__header">
        <div className="ui-stack ui-stack--2xs">
          <h3 className="ui-image-output-gallery__title ui-image-surface__title">{title}</h3>
          {datasetContext ? (
            <span className="ui-text-small ui-text-secondary">
              Dataset: {datasetContext.datasetAssetId}
              {datasetContext.datasetVersionId ? ` @ ${datasetContext.datasetVersionId}` : ""}
            </span>
          ) : null}
        </div>
        <span className="ui-text-small ui-text-secondary">
          {items.length} image{items.length === 1 ? "" : "s"}
        </span>
      </header>
      <ImageOutputGalleryCollection
        items={visibleItems}
        selection={selection}
        renderOptions={renderOptions}
        mode={presentationMode}
        onItemOpened={(payload) => {
          onItemOpened?.(payload);
          emitImageUiEvent(onEvent, {
            type: "gallery-item-opened",
            sourceComponent: "output-gallery",
            context: eventContext,
            payload,
          });
        }}
        onSelectionChanged={(selectionEvent) => {
          onSelectionChanged?.(selectionEvent);
          const selectedIds = selectionEvent.selection.selectedIds;
          const imageId = selectionEvent.selection.focusedId ?? selectedIds[selectedIds.length - 1];
          if (!imageId) {
            return;
          }
          const selected = selectedIds.includes(imageId);
          emitImageUiEvent(onEvent, {
            type: selected ? "image-selected" : "image-deselected",
            sourceComponent: "output-gallery",
            context: eventContext,
            payload: {
              imageId,
              selectionMode: "multi",
            },
          });
          emitImageUiEvent(onEvent, {
            type: "gallery-item-selected",
            sourceComponent: "output-gallery",
            context: eventContext,
            payload: {
              imageId,
              selected,
              selectedIds,
            },
          });
        }}
      />
      <footer className="ui-image-output-gallery__paging">
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
          Previous
        </button>
        <span className="ui-text-small ui-text-secondary">Page {page} / {totalPages}</span>
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
          Next
        </button>
      </footer>
    </section>
  );
}
