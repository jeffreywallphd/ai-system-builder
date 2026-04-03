import type { JSX } from "react";
import type { ImageRenderOptions, ImageUiViewModel } from "./ImageUiContracts";
import { ImageRenderFrame } from "./ImageRenderFrame";

export interface ImageGallerySliderProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly items: ReadonlyArray<ImageUiViewModel>;
  readonly selectedImageId?: string;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
  readonly className?: string;
  readonly renderOptions?: ImageRenderOptions;
  readonly onImageSelected?: (imageId: string) => void;
}

const defaultRenderOptions: ImageRenderOptions = Object.freeze({
  fitMode: "cover",
  zoomCapability: "disabled",
  placeholderBehavior: "show-placeholder",
  lazyLoad: true,
  allowSelectionHighlight: true,
});

export function ImageGallerySlider({
  title = "Gallery",
  subtitle,
  items,
  selectedImageId,
  loading = false,
  errorMessage,
  emptyMessage = "No images are ready yet.",
  className,
  renderOptions = defaultRenderOptions,
  onImageSelected,
}: ImageGallerySliderProps): JSX.Element {
  if (loading) {
    return (
      <section className={["ui-image-surface", "ui-image-surface--status", className ?? ""].filter(Boolean).join(" ")}>
        {title}: Loading images...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className={["ui-image-surface", "ui-image-surface--status", "ui-text-danger", className ?? ""].filter(Boolean).join(" ")}>
        {errorMessage}
      </section>
    );
  }

  return (
    <section className={["ui-image-surface", "ui-image-gallery-slider", className ?? ""].filter(Boolean).join(" ")}>
      <header className="ui-image-surface__header ui-image-gallery-slider__header">
        <div className="ui-stack ui-stack--2xs">
          <h3 className="ui-image-surface__title">{title}</h3>
          {subtitle ? <span className="ui-text-small ui-text-secondary">{subtitle}</span> : null}
        </div>
        <span className="ui-text-small ui-text-secondary">
          {items.length} image{items.length === 1 ? "" : "s"}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="ui-text-small ui-text-secondary">{emptyMessage}</p>
      ) : (
        <div className="ui-image-gallery-slider__track" role="listbox" aria-label={title}>
          {items.map((item, index) => {
            const selected = item.imageId === selectedImageId;
            const displayTitle = item.title ?? `Image ${index + 1}`;
            const displaySubtitle = item.subtitle ?? item.previewSummary?.timestamp;
            return (
              <button
                type="button"
                key={item.imageId}
                className={["ui-image-gallery-slider__item", selected ? "ui-image-gallery-slider__item--active" : ""].filter(Boolean).join(" ")}
                onClick={() => onImageSelected?.(item.imageId)}
                aria-pressed={selected}
                role="option"
                aria-selected={selected}
              >
                <ImageRenderFrame
                  image={item}
                  selected={selected}
                  className="ui-image-gallery-slider__frame"
                  renderOptions={renderOptions}
                  fallbackLabel="Image unavailable"
                />
                <span className="ui-text-small ui-image-gallery-slider__caption">{displayTitle}</span>
                {displaySubtitle ? <span className="ui-text-small ui-text-secondary">{displaySubtitle}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ImageGallerySlider;
