import type { JSX } from "react";
import type { ImageRenderOptions, ImageUiViewModel } from "./ImageUiContracts";
import { ImageViewer } from "./ImageViewer";
import { ImageStatusNotice } from "./ImageStatusNotice";

export interface ImagePreviewPanelProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly image?: ImageUiViewModel;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
  readonly unavailableMessage?: string;
  readonly className?: string;
  readonly renderOptions?: ImageRenderOptions;
}

const defaultRenderOptions: ImageRenderOptions = Object.freeze({
  fitMode: "contain",
  zoomCapability: "buttons",
  placeholderBehavior: "show-placeholder",
  lazyLoad: false,
  allowSelectionHighlight: true,
});

export function ImagePreviewPanel({
  title = "Image preview",
  subtitle,
  image,
  loading = false,
  errorMessage,
  emptyMessage = "Choose an image to preview.",
  unavailableMessage = "This image is unavailable right now.",
  className,
  renderOptions = defaultRenderOptions,
}: ImagePreviewPanelProps): JSX.Element {
  const normalizedImage = image
    ? Object.freeze({
      ...image,
      sourceUrl: image.sourceUrl ?? image.thumbnailUrl,
    })
    : undefined;

  const hasVisibleImage = Boolean(normalizedImage?.sourceUrl);

  return (
    <section className={["ui-image-surface", "ui-image-preview-panel", className ?? ""].filter(Boolean).join(" ")}>
      <header className="ui-image-surface__header">
        <div className="ui-stack ui-stack--2xs">
          <h3 className="ui-image-surface__title">{title}</h3>
          {subtitle ? <span className="ui-text-small ui-text-secondary">{subtitle}</span> : null}
        </div>
      </header>
      {loading ? (
        <ImageStatusNotice
          title="Loading preview"
          message="Getting this image ready."
        />
      ) : null}
      {!loading && errorMessage ? (
        <ImageStatusNotice
          title="Preview unavailable"
          message={errorMessage}
          tone="danger"
        />
      ) : null}
      {!loading && !errorMessage && !normalizedImage ? (
        <ImageStatusNotice
          title="No image selected"
          message={emptyMessage}
        />
      ) : null}
      {!loading && !errorMessage && normalizedImage && !hasVisibleImage ? (
        <ImageStatusNotice
          title="Image not available"
          message={unavailableMessage}
          tone="warning"
        />
      ) : null}
      {!loading && !errorMessage && normalizedImage && hasVisibleImage ? (
        <ImageViewer
          image={normalizedImage}
          renderOptions={renderOptions}
          selection={{
            mode: "single",
            selectedIds: [normalizedImage.imageId],
            focusedId: normalizedImage.imageId,
          }}
          showMetadata
        />
      ) : null}
    </section>
  );
}

export default ImagePreviewPanel;
