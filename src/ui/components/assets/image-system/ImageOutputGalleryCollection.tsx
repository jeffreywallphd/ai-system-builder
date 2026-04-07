import type { JSX } from "react";
import { ImageRenderFrame } from "./ImageRenderFrame";
import { MetadataSummaryPanel, ParameterSummaryPanel } from "./ImageSummaryPanels";
import { isImageSelectionActive } from "./ImageRenderingUtils";
import type { ImageCollectionPresentationMode, ImageOutputGalleryEventContract, ImageOutputGalleryPropsContract, ImageUiViewModel } from "./ImageUiContracts";

interface ItemCardProps {
  readonly item: ImageUiViewModel;
  readonly selected: boolean;
  readonly renderOptions: ImageOutputGalleryPropsContract["renderOptions"];
  readonly onOpen?: (imageId: string) => void;
  readonly onToggleSelected?: (imageId: string) => void;
  readonly mode: ImageCollectionPresentationMode;
}

function ImageOutputGalleryItemCard({ item, selected, renderOptions, onOpen, onToggleSelected, mode }: ItemCardProps): JSX.Element {
  return (
    <article className={["ui-image-output-gallery__item", "ui-image-item-card", mode === "list" ? "ui-image-output-gallery__item--list" : "", selected ? "ui-image-item-card--selected" : ""].filter(Boolean).join(" ")}>
      <button type="button" className="ui-image-output-gallery__button" onClick={() => onOpen?.(item.imageId)}>
        <ImageRenderFrame image={item} renderOptions={renderOptions} selected={selected} className="ui-image-output-gallery__frame" />
      </button>
      <div className="ui-image-output-gallery__meta-stack">
        <div className="ui-image-output-gallery__meta">
          <span className="ui-text-small"><strong>{item.title ?? item.imageId}</strong></span>
          <button type="button" className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => onToggleSelected?.(item.imageId)}>
            {selected ? "Deselect" : "Select"}
          </button>
        </div>
        {item.subtitle ? <span className="ui-text-small ui-text-secondary">{item.subtitle}</span> : null}
        <div className="ui-image-output-gallery__info-row ui-text-small ui-text-secondary">
          {item.previewSummary?.timestamp ? <span>{item.previewSummary.timestamp}</span> : null}
          {item.previewSummary?.workflowSummary ? <span>{item.previewSummary.workflowSummary}</span> : null}
        </div>
        <div className="ui-image-output-gallery__summary-grid">
          <ParameterSummaryPanel summary={item.previewSummary?.parameterSummary} />
          <MetadataSummaryPanel summary={item.previewSummary?.metadataSummary} />
        </div>
      </div>
    </article>
  );
}

export interface ImageOutputGalleryCollectionProps extends ImageOutputGalleryPropsContract, ImageOutputGalleryEventContract {
  readonly mode?: ImageCollectionPresentationMode;
}

export function ImageOutputGalleryCollection({ items, selection, renderOptions, mode = "grid", onSelectionChanged, onItemOpened }: ImageOutputGalleryCollectionProps): JSX.Element {
  const currentSelection = selection?.selectedIds ?? [];
  return (
    <div className={["ui-image-output-gallery__grid", mode === "list" ? "ui-image-output-gallery__grid--list" : ""].join(" ")}>
      {items.map((item) => {
        const selected = isImageSelectionActive(selection, item.imageId);
        return (
          <ImageOutputGalleryItemCard
            key={item.imageId}
            item={item}
            selected={selected}
            renderOptions={renderOptions}
            mode={mode}
            onOpen={(imageId) => onItemOpened?.({ imageId })}
            onToggleSelected={(imageId) => {
              const selectedSet = new Set(currentSelection);
              if (selectedSet.has(imageId)) {
                selectedSet.delete(imageId);
              } else {
                selectedSet.add(imageId);
              }
              onSelectionChanged?.({
                sourceComponent: "output-gallery",
                selection: Object.freeze({
                  mode: "multi",
                  selectedIds: Object.freeze([...selectedSet]),
                  focusedId: imageId,
                }),
              });
            }}
          />
        );
      })}
    </div>
  );
}
