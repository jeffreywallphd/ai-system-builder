import type {
  ImageRenderFitMode,
  ImageRenderMetadata,
  ImageRenderOptions,
  ImageRenderPlaceholderBehavior,
  ImageSelectionState,
  ImageUiViewModel,
} from "./ImageUiContracts";

export interface ImageContainerSize {
  readonly width: number;
  readonly height: number;
}

export interface NormalizedImageRenderMetadata extends ImageRenderMetadata {
  readonly width?: number;
  readonly height?: number;
  readonly aspectRatio?: number;
  readonly orientation: "landscape" | "portrait" | "square" | "unknown";
}

export type ImageRenderAvailability = "ready" | "loading" | "missing-source" | "placeholder" | "error";

export function normalizeImageRenderMetadata(metadata?: ImageRenderMetadata): NormalizedImageRenderMetadata {
  const width = normalizePositiveNumber(metadata?.width);
  const height = normalizePositiveNumber(metadata?.height);
  const providedAspectRatio = normalizePositiveNumber(metadata?.aspectRatio);
  const derivedAspectRatio = width && height ? width / height : undefined;
  const aspectRatio = providedAspectRatio ?? derivedAspectRatio;

  return Object.freeze({
    ...metadata,
    width,
    height,
    aspectRatio,
    orientation: metadata?.orientation ?? deriveOrientation(width, height),
  });
}

export function resolveImageFitStyle(fitMode: ImageRenderFitMode): "contain" | "cover" | "fill" | "scale-down" {
  return fitMode;
}

export function computeImageLayoutSize(input: {
  readonly container: ImageContainerSize;
  readonly metadata: ImageRenderMetadata;
  readonly fitMode: ImageRenderFitMode;
}): ImageContainerSize {
  const metadata = normalizeImageRenderMetadata(input.metadata);
  const containerWidth = Math.max(1, input.container.width);
  const containerHeight = Math.max(1, input.container.height);
  const intrinsicWidth = metadata.width ?? containerWidth;
  const intrinsicHeight = metadata.height ?? containerHeight;

  if (input.fitMode === "fill") {
    return Object.freeze({ width: containerWidth, height: containerHeight });
  }

  const widthScale = containerWidth / intrinsicWidth;
  const heightScale = containerHeight / intrinsicHeight;

  if (input.fitMode === "cover") {
    const scale = Math.max(widthScale, heightScale);
    return Object.freeze({
      width: Math.round(intrinsicWidth * scale),
      height: Math.round(intrinsicHeight * scale),
    });
  }

  if (input.fitMode === "scale-down") {
    const scale = Math.min(1, Math.min(widthScale, heightScale));
    return Object.freeze({
      width: Math.round(intrinsicWidth * scale),
      height: Math.round(intrinsicHeight * scale),
    });
  }

  const scale = Math.min(widthScale, heightScale);
  return Object.freeze({
    width: Math.round(intrinsicWidth * scale),
    height: Math.round(intrinsicHeight * scale),
  });
}

export function resolvePlaceholderState(input: {
  readonly behavior: ImageRenderPlaceholderBehavior;
  readonly availability: ImageRenderAvailability;
}): { readonly shouldRenderPlaceholder: boolean; readonly keepSpace: boolean } {
  if (input.behavior === "hide") {
    return Object.freeze({ shouldRenderPlaceholder: false, keepSpace: false });
  }
  if (input.behavior === "keep-space") {
    return Object.freeze({ shouldRenderPlaceholder: input.availability !== "ready", keepSpace: true });
  }
  return Object.freeze({ shouldRenderPlaceholder: input.availability !== "ready", keepSpace: false });
}

export function resolveImageAvailability(input: {
  readonly image: ImageUiViewModel;
  readonly isLoading?: boolean;
  readonly hasError?: boolean;
}): ImageRenderAvailability {
  if (input.hasError) {
    return "error";
  }
  if (input.image.isPlaceholder) {
    return "placeholder";
  }
  if (!input.image.sourceUrl) {
    return "missing-source";
  }
  if (input.isLoading) {
    return "loading";
  }
  return "ready";
}

export function isImageSelectionActive(selection: ImageSelectionState | undefined, imageId: string): boolean {
  return Boolean(selection?.selectedIds.includes(imageId));
}

export function createImageElementLoadingProps(options: ImageRenderOptions): Pick<HTMLImageElement, "loading" | "decoding"> {
  return Object.freeze({
    loading: options.lazyLoad ? "lazy" : "eager",
    decoding: "async",
  });
}

function deriveOrientation(width?: number, height?: number): "landscape" | "portrait" | "square" | "unknown" {
  if (!width || !height) {
    return "unknown";
  }
  if (width === height) {
    return "square";
  }
  return width > height ? "landscape" : "portrait";
}

function normalizePositiveNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
