import type { CSSProperties } from "react";
import type { PanelAssetLayoutBounds } from "../experience-assets/PanelAssetContracts";

export interface SystemPageViewportLayoutInterpretation {
  readonly headerHeightPercent: number;
  readonly sectionGapVar: string;
  readonly sectionMinSizeVar: string;
}

export const defaultSystemPageViewportLayoutInterpretation: SystemPageViewportLayoutInterpretation = Object.freeze({
  headerHeightPercent: 14,
  sectionGapVar: "var(--space-sm)",
  sectionMinSizeVar: "48px",
});

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

const overlapTolerance = 1e-6;

export function normalizeViewportSectionBounds(bounds: PanelAssetLayoutBounds): PanelAssetLayoutBounds {
  const width = Math.max(0, Math.min(1, clamp01(bounds.width)));
  const height = Math.max(0, Math.min(1, clamp01(bounds.height)));
  const x = Math.max(0, Math.min(1 - width, clamp01(bounds.x)));
  const y = Math.max(0, Math.min(1 - height, clamp01(bounds.y)));
  return Object.freeze({ x, y, width, height });
}

export function mapViewportSectionBoundsToStyle(input: {
  readonly bounds: PanelAssetLayoutBounds;
  readonly interpretation?: SystemPageViewportLayoutInterpretation;
}): CSSProperties {
  const interpretation = input.interpretation ?? defaultSystemPageViewportLayoutInterpretation;
  const bounded = normalizeViewportSectionBounds(input.bounds);
  const xPercent = bounded.x * 100;
  const yPercent = bounded.y * 100;
  const widthPercent = bounded.width * 100;
  const heightPercent = bounded.height * 100;

  return Object.freeze({
    left: `calc(${xPercent}% + (${interpretation.sectionGapVar} * 0.5))`,
    top: `calc(${yPercent}% + (${interpretation.sectionGapVar} * 0.5))`,
    width: `max(${interpretation.sectionMinSizeVar}, calc(${widthPercent}% - ${interpretation.sectionGapVar}))`,
    height: `max(${interpretation.sectionMinSizeVar}, calc(${heightPercent}% - ${interpretation.sectionGapVar}))`,
  });
}

export function areViewportSectionsOverlapping(input: {
  readonly a: PanelAssetLayoutBounds;
  readonly b: PanelAssetLayoutBounds;
}): boolean {
  const a = normalizeViewportSectionBounds(input.a);
  const b = normalizeViewportSectionBounds(input.b);
  const separated = (
    (a.x + a.width) <= (b.x + overlapTolerance)
    || (b.x + b.width) <= (a.x + overlapTolerance)
    || (a.y + a.height) <= (b.y + overlapTolerance)
    || (b.y + b.height) <= (a.y + overlapTolerance)
  );
  return !separated;
}
