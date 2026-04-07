import { useMemo, useState } from "react";
import type { ImageComparisonViewportState } from "./ImageUiContracts";

export interface UseSynchronizedImageViewportOptions {
  readonly initialZoom?: number;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly zoomStep?: number;
}

export interface SynchronizedImageViewportApi {
  readonly viewport: ImageComparisonViewportState;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly resetViewport: () => void;
  readonly panBy: (deltaX: number, deltaY: number) => void;
  readonly setViewport: (viewport: ImageComparisonViewportState) => void;
}

const DEFAULT_VIEWPORT: ImageComparisonViewportState = Object.freeze({
  zoom: 1,
  panX: 0,
  panY: 0,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(value.toFixed(4))));
}

export function normalizeViewport(input: {
  readonly viewport: ImageComparisonViewportState;
  readonly minZoom: number;
  readonly maxZoom: number;
}): ImageComparisonViewportState {
  const zoom = clamp(input.viewport.zoom, input.minZoom, input.maxZoom);
  return Object.freeze({
    zoom,
    panX: Number(input.viewport.panX.toFixed(2)),
    panY: Number(input.viewport.panY.toFixed(2)),
  });
}

export function useSynchronizedImageViewport(options: UseSynchronizedImageViewportOptions = {}): SynchronizedImageViewportApi {
  const minZoom = options.minZoom ?? 1;
  const maxZoom = options.maxZoom ?? 8;
  const zoomStep = options.zoomStep ?? 0.25;

  const [viewport, setViewportState] = useState<ImageComparisonViewportState>(() =>
    normalizeViewport({
      viewport: Object.freeze({ ...DEFAULT_VIEWPORT, zoom: options.initialZoom ?? DEFAULT_VIEWPORT.zoom }),
      minZoom,
      maxZoom,
    }),
  );

  const setViewport = (nextViewport: ImageComparisonViewportState): void => {
    setViewportState(normalizeViewport({ viewport: nextViewport, minZoom, maxZoom }));
  };

  return useMemo(
    () => ({
      viewport,
      setViewport,
      resetViewport: () => setViewport(DEFAULT_VIEWPORT),
      zoomIn: () => setViewport({ ...viewport, zoom: viewport.zoom + zoomStep }),
      zoomOut: () => setViewport({ ...viewport, zoom: viewport.zoom - zoomStep }),
      panBy: (deltaX: number, deltaY: number) =>
        setViewport({
          ...viewport,
          panX: viewport.panX + deltaX,
          panY: viewport.panY + deltaY,
        }),
    }),
    [viewport, zoomStep],
  );
}
