import { useMemo, useState, type JSX } from "react";
import type {
  ImageSelectionChangeEvent,
  ImageViewerEventContract,
  ImageViewerPropsContract,
} from "./ImageUiContracts";
import { ImageRenderFrame } from "./ImageRenderFrame";
import { emitImageUiEvent } from "./ImageUiEventAdapters";
import { isImageSelectionActive, normalizeImageRenderMetadata } from "./ImageRenderingUtils";

export interface ImageViewerProps extends ImageViewerPropsContract, ImageViewerEventContract {
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
  readonly showMetadata?: boolean;
  readonly className?: string;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly zoomStep?: number;
}

function createSelectionEvent(imageId: string): ImageSelectionChangeEvent {
  return {
    sourceComponent: "image-viewer",
    selection: {
      mode: "single",
      selectedIds: Object.freeze([imageId]),
      focusedId: imageId,
    },
  };
}

export function ImageViewer({
  image,
  selection,
  renderOptions,
  eventContext,
  onImageSelected,
  onZoomRequested,
  onEvent,
  loading = false,
  errorMessage,
  emptyMessage = "No image selected.",
  showMetadata = true,
  className,
  minZoom = 1,
  maxZoom = 4,
  zoomStep = 0.25,
}: ImageViewerProps): JSX.Element {
  const metadata = useMemo(() => normalizeImageRenderMetadata(image.metadata), [image.metadata]);
  const [zoom, setZoom] = useState(1);
  const isSelected = isImageSelectionActive(selection, image.imageId);

  if (!image.sourceUrl && !loading && !errorMessage) {
    return <div className="ui-image-viewer ui-image-viewer--empty">{emptyMessage}</div>;
  }

  if (errorMessage) {
    return <div className="ui-image-viewer ui-image-viewer--error ui-text-danger">{errorMessage}</div>;
  }

  const requestZoom = (delta: number) => {
    const nextZoom = Math.min(maxZoom, Math.max(minZoom, Number((zoom + delta).toFixed(2))));
    setZoom(nextZoom);
    onZoomRequested?.({ imageId: image.imageId, delta });
    emitImageUiEvent(onEvent, {
      type: "viewer-zoom-requested",
      sourceComponent: "image-viewer",
      context: eventContext ?? image.context,
      payload: {
        imageId: image.imageId,
        delta,
        zoom: nextZoom,
      },
    });
    emitImageUiEvent(onEvent, {
      type: "viewer-interaction",
      sourceComponent: "image-viewer",
      context: eventContext ?? image.context,
      payload: {
        interactionType: "zoom",
        imageId: image.imageId,
        details: Object.freeze({ delta, zoom: nextZoom }),
      },
    });
  };

  return (
    <section className={["ui-image-viewer", "ui-image-surface", className ?? ""].filter(Boolean).join(" ")} aria-busy={loading}>
      <div className="ui-image-viewer__toolbar ui-image-surface__toolbar">
        <span className="ui-text-small ui-text-secondary">Fit: {renderOptions.fitMode}</span>
        <div className="ui-row ui-image-control-group">
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => requestZoom(-zoomStep)}>-</button>
          <span className="ui-text-small ui-text-secondary">{Math.round(zoom * 100)}%</span>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => requestZoom(zoomStep)}>+</button>
          <button
            type="button"
            className={`ui-button ui-button--sm ${isSelected ? "ui-button--primary" : "ui-button--ghost"}`}
            aria-pressed={isSelected}
            onClick={() => {
              onImageSelected?.(createSelectionEvent(image.imageId));
              emitImageUiEvent(onEvent, {
                type: isSelected ? "image-deselected" : "image-selected",
                sourceComponent: "image-viewer",
                context: eventContext ?? image.context,
                payload: {
                  imageId: image.imageId,
                  selectionMode: "single",
                },
              });
              emitImageUiEvent(onEvent, {
                type: "viewer-interaction",
                sourceComponent: "image-viewer",
                context: eventContext ?? image.context,
                payload: {
                  interactionType: "select",
                  imageId: image.imageId,
                  details: Object.freeze({ selected: !isSelected }),
                },
              });
            }}
          >
            {isSelected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
      <div className="ui-image-viewer__canvas" style={{ ["--ui-image-viewer-zoom" as string]: String(zoom) }}>
        <ImageRenderFrame
          image={image}
          renderOptions={renderOptions}
          loading={loading}
          selected={isSelected}
          fallbackLabel={emptyMessage}
          className="ui-image-viewer__frame"
        />
      </div>
      {showMetadata ? (
        <dl className="ui-image-viewer__metadata">
          <div><dt>Dimensions</dt><dd>{metadata.width && metadata.height ? `${metadata.width}×${metadata.height}` : "Unknown"}</dd></div>
          <div><dt>Format</dt><dd>{metadata.format ?? metadata.mimeType ?? "Unknown"}</dd></div>
          <div><dt>Orientation</dt><dd>{metadata.orientation}</dd></div>
        </dl>
      ) : null}
    </section>
  );
}
