import { useEffect, useMemo, useState, type JSX } from "react";
import { ImageRenderFrame } from "./ImageRenderFrame";
import type {
  ImageComparisonMode,
  ImageComparisonViewEventContract,
  ImageComparisonViewPropsContract,
  ImageSelectionChangeEvent,
} from "./ImageUiContracts";
import { isImageSelectionActive } from "./ImageRenderingUtils";
import { useSynchronizedImageViewport } from "./useSynchronizedImageViewport";

export interface ImageComparisonViewProps extends ImageComparisonViewPropsContract, ImageComparisonViewEventContract {
  readonly title?: string;
  readonly className?: string;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly emptyMessage?: string;
}

function createSelectionEvent(selectedIds: ReadonlyArray<string>, focusedId: string): ImageSelectionChangeEvent {
  return {
    sourceComponent: "comparison-view",
    selection: Object.freeze({
      mode: "multi",
      selectedIds,
      focusedId,
    }),
  };
}

function renderModeLabel(mode: ImageComparisonMode): string {
  return mode === "overlay" ? "Overlay" : "Side by side";
}

export function ImageComparisonView({
  items,
  mode,
  renderOptions,
  activeImageIds,
  focusedImageId,
  onSwapRequested,
  onSelectionChanged,
  onModeChanged,
  onViewportChanged,
  title = "Image comparison",
  className,
  loading = false,
  errorMessage,
  emptyMessage = "Select two images to compare.",
}: ImageComparisonViewProps): JSX.Element {
  const viewport = useSynchronizedImageViewport({ minZoom: 1, maxZoom: 8, zoomStep: 0.2 });
  const [overlayPosition, setOverlayPosition] = useState(50);
  useEffect(() => {
    onViewportChanged?.(viewport.viewport);
  }, [onViewportChanged, viewport.viewport]);

  const comparableItems = useMemo(() => items.slice(0, 2), [items]);

  if (loading) {
    return <section className="ui-image-comparison-view ui-image-comparison-view--status">Loading comparison…</section>;
  }
  if (errorMessage) {
    return <section className="ui-image-comparison-view ui-image-comparison-view--status ui-text-danger">{errorMessage}</section>;
  }
  if (comparableItems.length < 2) {
    return <section className="ui-image-comparison-view ui-image-comparison-view--status">{emptyMessage}</section>;
  }

  const [first, second] = comparableItems;
  const selectedIds = activeImageIds ?? [];

  const toggleSelection = (imageId: string): void => {
    const next = new Set(selectedIds);
    if (next.has(imageId)) {
      next.delete(imageId);
    } else {
      next.add(imageId);
    }
    onSelectionChanged?.(createSelectionEvent(Object.freeze([...next]), imageId));
  };

  const onPan = (direction: "left" | "right" | "up" | "down") => {
    if (direction === "left") {
      viewport.panBy(-20, 0);
    } else if (direction === "right") {
      viewport.panBy(20, 0);
    } else if (direction === "up") {
      viewport.panBy(0, -20);
    } else {
      viewport.panBy(0, 20);
    }
  };

  return (
    <section className={["ui-image-comparison-view", className ?? ""].filter(Boolean).join(" ")}>
      <header className="ui-image-comparison-view__header">
        <div className="ui-stack ui-stack--2xs">
          <h3 className="ui-image-comparison-view__title">{title}</h3>
          <span className="ui-text-small ui-text-secondary">{first.label ?? first.image.title ?? first.image.imageId} vs {second.label ?? second.image.title ?? second.image.imageId}</span>
        </div>
        <div className="ui-row ui-row--wrap">
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onModeChanged?.(mode === "overlay" ? "side-by-side" : "overlay")}>{renderModeLabel(mode)}</button>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={viewport.zoomOut}>-</button>
          <span className="ui-text-small ui-text-secondary">{Math.round(viewport.viewport.zoom * 100)}%</span>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={viewport.zoomIn}>+</button>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={viewport.resetViewport}>Reset</button>
          <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={onSwapRequested}>Swap</button>
        </div>
      </header>

      <div className="ui-image-comparison-view__pan-controls">
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onPan("left")}>←</button>
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onPan("right")}>→</button>
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onPan("up")}>↑</button>
        <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onPan("down")}>↓</button>
      </div>

      {mode === "overlay" ? (
        <div className="ui-image-comparison-view__overlay-surface" style={{ ["--ui-image-compare-zoom" as string]: String(viewport.viewport.zoom), ["--ui-image-compare-pan-x" as string]: `${viewport.viewport.panX}px`, ["--ui-image-compare-pan-y" as string]: `${viewport.viewport.panY}px` }}>
          <ImageRenderFrame image={first.image} renderOptions={renderOptions} selected={isImageSelectionActive({ mode: "multi", selectedIds }, first.image.imageId)} className="ui-image-comparison-view__overlay-base" />
          <div className="ui-image-comparison-view__overlay-top" style={{ clipPath: `inset(0 ${100 - overlayPosition}% 0 0)` }}>
            <ImageRenderFrame image={second.image} renderOptions={renderOptions} selected={isImageSelectionActive({ mode: "multi", selectedIds }, second.image.imageId)} className="ui-image-comparison-view__overlay-frame" />
          </div>
          <input type="range" className="ui-slider" min={0} max={100} step={1} value={overlayPosition} onChange={(event) => setOverlayPosition(Number(event.target.value))} aria-label="Overlay split" />
        </div>
      ) : (
        <div className="ui-image-comparison-view__grid" style={{ ["--ui-image-compare-zoom" as string]: String(viewport.viewport.zoom), ["--ui-image-compare-pan-x" as string]: `${viewport.viewport.panX}px`, ["--ui-image-compare-pan-y" as string]: `${viewport.viewport.panY}px` }}>
          {[first, second].map((item) => {
            const selected = isImageSelectionActive({ mode: "multi", selectedIds, focusedId: focusedImageId }, item.image.imageId);
            return (
              <article key={item.image.imageId} className="ui-image-comparison-view__item">
                <ImageRenderFrame image={item.image} renderOptions={renderOptions} selected={selected} className="ui-image-comparison-view__frame" />
                <div className="ui-row ui-row--between ui-row--wrap">
                  <span className="ui-text-small">{item.label ?? item.image.title ?? item.image.imageId}</span>
                  <button type="button" className={`ui-button ui-button--sm ${selected ? "ui-button--primary" : "ui-button--ghost"}`} onClick={() => toggleSelection(item.image.imageId)}>{selected ? "Focused" : "Focus"}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
