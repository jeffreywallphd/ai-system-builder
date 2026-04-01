import { useMemo, useState, type JSX } from "react";
import type { ImageRenderOptions, ImageUiViewModel } from "./ImageUiContracts";
import {
  createImageElementLoadingProps,
  isImageSelectionActive,
  normalizeImageRenderMetadata,
  resolveImageAvailability,
  resolveImageFitStyle,
  resolvePlaceholderState,
} from "./ImageRenderingUtils";

export interface ImageRenderFrameProps {
  readonly image: ImageUiViewModel;
  readonly renderOptions: ImageRenderOptions;
  readonly loading?: boolean;
  readonly selected?: boolean;
  readonly error?: boolean;
  readonly fallbackLabel?: string;
  readonly className?: string;
}

export function ImageRenderFrame({
  image,
  renderOptions,
  loading = false,
  selected = false,
  error = false,
  fallbackLabel = "Image preview unavailable.",
  className,
}: ImageRenderFrameProps): JSX.Element {
  const metadata = useMemo(() => normalizeImageRenderMetadata(image.metadata), [image.metadata]);
  const [loadFailed, setLoadFailed] = useState(false);
  const availability = resolveImageAvailability({
    image,
    isLoading: loading,
    hasError: error || loadFailed,
  });
  const placeholderState = resolvePlaceholderState({
    behavior: renderOptions.placeholderBehavior,
    availability,
  });
  const loadingProps = createImageElementLoadingProps(renderOptions);

  return (
    <div
      className={[
        "ui-image-render-frame",
        selected ? "ui-image-render-frame--selected" : "",
        placeholderState.keepSpace ? "ui-image-render-frame--keep-space" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
      data-orientation={metadata.orientation}
      data-availability={availability}
      aria-busy={availability === "loading"}
    >
      {image.sourceUrl && availability !== "loading" && availability !== "error" ? (
        <img
          className="ui-image-render-frame__img"
          src={image.sourceUrl}
          alt={metadata.altText ?? image.title ?? "Image"}
          style={{ objectFit: resolveImageFitStyle(renderOptions.fitMode) }}
          onError={() => setLoadFailed(true)}
          {...loadingProps}
        />
      ) : null}
      {placeholderState.shouldRenderPlaceholder ? (
        <div className="ui-image-render-frame__placeholder">
          {availability === "loading" ? "Loading image…" : fallbackLabel}
        </div>
      ) : null}
    </div>
  );
}

export function resolveSelectionForImage(input: {
  readonly imageId: string;
  readonly selectedIds?: ReadonlyArray<string>;
}): boolean {
  return isImageSelectionActive(
    input.selectedIds ? { mode: "multi", selectedIds: input.selectedIds } : undefined,
    input.imageId,
  );
}
