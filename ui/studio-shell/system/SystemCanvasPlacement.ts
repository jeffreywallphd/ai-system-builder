import type { CanvasSurfaceViewportModel } from "../experience-assets/ConfigurableCanvasSurfaceContracts";

export interface SystemCanvasNodeSize {
  readonly width: number;
  readonly height: number;
}

const minimumNormalizedSize = 0.05;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeSize(size: SystemCanvasNodeSize): SystemCanvasNodeSize {
  return Object.freeze({
    width: clamp(size.width, minimumNormalizedSize, 1),
    height: clamp(size.height, minimumNormalizedSize, 1),
  });
}

export function resolveCenteredNormalizedPlacement(input: {
  readonly viewport?: CanvasSurfaceViewportModel;
  readonly nodeSize: SystemCanvasNodeSize;
}): { readonly x: number; readonly y: number } {
  const size = normalizeSize(input.nodeSize);
  const centerX = clamp(input.viewport?.center.x ?? 0.5, 0, 1);
  const centerY = clamp(input.viewport?.center.y ?? 0.5, 0, 1);
  return Object.freeze({
    x: clamp(centerX - (size.width / 2), 0, 1 - size.width),
    y: clamp(centerY - (size.height / 2), 0, 1 - size.height),
  });
}
