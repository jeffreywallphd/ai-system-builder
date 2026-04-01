import { useMemo, useState, type JSX } from "react";
import type {
  ImageOutputGalleryEventContract,
  ImageOutputGalleryPropsContract,
  ImageSelectionChangeEvent,
} from "./ImageUiContracts";
import { ImageRenderFrame } from "./ImageRenderFrame";
import { emitImageUiEvent } from "./ImageUiEventAdapters";
import { isImageSelectionActive } from "./ImageRenderingUtils";

export interface ImageOutputGalleryProps extends ImageOutputGalleryPropsContract, ImageOutputGalleryEventContract {
  readonly title?: string;
  readonly className?: string;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
  readonly pageSize?: number;
}

function createSelectionEvent(selectedIds: ReadonlyArray<string>, focusedId: string): ImageSelectionChangeEvent {
  return {
    sourceComponent: "output-gallery",
    selection: Object.freeze({
      mode: "multi",
      selectedIds,
      focusedId,
    }),
  };
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
      <div className="ui-image-output-gallery__grid">
        {visibleItems.map((item) => {
          const selected = isImageSelectionActive(selection, item.imageId);
          const currentSelection = selection?.selectedIds ?? [];
          return (
            <article key={item.imageId} className={["ui-image-output-gallery__item", "ui-image-item-card", selected ? "ui-image-output-gallery__item--selected ui-image-item-card--selected" : ""].filter(Boolean).join(" ")}>
              <button
                type="button"
                className="ui-image-output-gallery__button"
                onClick={() => {
                  onItemOpened?.({ imageId: item.imageId });
                  emitImageUiEvent(onEvent, {
                    type: "gallery-item-opened",
                    sourceComponent: "output-gallery",
                    context: eventContext ?? item.context,
                    payload: { imageId: item.imageId },
                  });
                }}
              >
                <ImageRenderFrame image={item} renderOptions={renderOptions} selected={selected} className="ui-image-output-gallery__frame" />
              </button>
              <div className="ui-image-output-gallery__meta">
                <span className="ui-text-small">{item.title ?? item.imageId}</span>
                <button
                  type="button"
                  className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`}
                  onClick={() => {
                    const selectedSet = new Set(currentSelection);
                    if (selectedSet.has(item.imageId)) {
                      selectedSet.delete(item.imageId);
                    } else {
                      selectedSet.add(item.imageId);
                    }
                    const selectedIds = Object.freeze([...selectedSet]);
                    onSelectionChanged?.(createSelectionEvent(selectedIds, item.imageId));
                    emitImageUiEvent(onEvent, {
                      type: selected ? "image-deselected" : "image-selected",
                      sourceComponent: "output-gallery",
                      context: eventContext ?? item.context,
                      payload: {
                        imageId: item.imageId,
                        selectionMode: "multi",
                      },
                    });
                    emitImageUiEvent(onEvent, {
                      type: "gallery-item-selected",
                      sourceComponent: "output-gallery",
                      context: eventContext ?? item.context,
                      payload: {
                        imageId: item.imageId,
                        selected: !selected,
                        selectedIds,
                      },
                    });
                  }}
                >
                  {selected ? "Deselect" : "Select"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
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
