export const SURFACE_BREAKPOINTS = Object.freeze({
  mobileMaxWidthPx: 767,
  tabletMaxWidthPx: 1023,
  desktopCompactMaxWidthPx: 1279,
  desktopComfortableMinWidthPx: 1280,
});

export type SurfaceViewport = "mobile" | "tablet" | "desktop";

export type SurfaceDensity = "comfortable" | "compact";

export type SurfaceInteractionMode = "touch" | "pointer";

export type SurfaceTableLayoutMode = "cards" | "rows-compact" | "rows";

export type SurfaceFormLayoutMode = "stacked" | "split";

export type SurfaceStatusCardLayoutMode = "stacked" | "grid";

export type SurfaceActionMenuLayoutMode = "sheet" | "menu";

export type SurfacePanelLayoutMode = "stacked" | "split" | "split-with-collapsed-detail";

export type SurfaceNavigationMode = "collapsible" | "inline";

export type SurfaceScrollRegionMode = "document" | "panel";

export interface SurfaceResponsiveProfile {
  readonly viewport: SurfaceViewport;
  readonly density: SurfaceDensity;
  readonly interactionMode: SurfaceInteractionMode;
  readonly minTouchTargetPx: 44 | 36;
  readonly tableLayout: SurfaceTableLayoutMode;
  readonly formLayout: SurfaceFormLayoutMode;
  readonly statusCardLayout: SurfaceStatusCardLayoutMode;
  readonly actionMenuLayout: SurfaceActionMenuLayoutMode;
  readonly panelLayout: SurfacePanelLayoutMode;
  readonly navigationMode: SurfaceNavigationMode;
  readonly scrollRegionMode: SurfaceScrollRegionMode;
}

export interface SurfaceResponsiveProfileInput {
  readonly viewportWidthPx: number;
  readonly preferDesktopComfortableDensity?: boolean;
}

function toFiniteWidth(viewportWidthPx: number): number {
  if (Number.isFinite(viewportWidthPx)) {
    return Math.max(0, Math.round(viewportWidthPx));
  }
  return SURFACE_BREAKPOINTS.desktopComfortableMinWidthPx;
}

export function toSurfaceViewport(viewportWidthPx: number): SurfaceViewport {
  const width = toFiniteWidth(viewportWidthPx);
  if (width <= SURFACE_BREAKPOINTS.mobileMaxWidthPx) {
    return "mobile";
  }
  if (width <= SURFACE_BREAKPOINTS.tabletMaxWidthPx) {
    return "tablet";
  }
  return "desktop";
}

export function createSurfaceResponsiveProfile(
  input: SurfaceResponsiveProfileInput,
): SurfaceResponsiveProfile {
  const width = toFiniteWidth(input.viewportWidthPx);
  const viewport = toSurfaceViewport(width);
  const isDesktopCompact = width <= SURFACE_BREAKPOINTS.desktopCompactMaxWidthPx;

  if (viewport === "mobile") {
    return Object.freeze({
      viewport,
      density: "comfortable",
      interactionMode: "touch",
      minTouchTargetPx: 44,
      tableLayout: "cards",
      formLayout: "stacked",
      statusCardLayout: "stacked",
      actionMenuLayout: "sheet",
      panelLayout: "stacked",
      navigationMode: "collapsible",
      scrollRegionMode: "document",
    });
  }

  if (viewport === "tablet") {
    return Object.freeze({
      viewport,
      density: "comfortable",
      interactionMode: "touch",
      minTouchTargetPx: 44,
      tableLayout: "rows-compact",
      formLayout: "stacked",
      statusCardLayout: "grid",
      actionMenuLayout: "menu",
      panelLayout: "split-with-collapsed-detail",
      navigationMode: "collapsible",
      scrollRegionMode: "panel",
    });
  }

  const density = input.preferDesktopComfortableDensity ? "comfortable" : "compact";
  return Object.freeze({
    viewport,
    density,
    interactionMode: "pointer",
    minTouchTargetPx: 36,
    tableLayout: isDesktopCompact ? "rows-compact" : "rows",
    formLayout: "split",
    statusCardLayout: "grid",
    actionMenuLayout: "menu",
    panelLayout: isDesktopCompact ? "split-with-collapsed-detail" : "split",
    navigationMode: "inline",
    scrollRegionMode: "panel",
  });
}

export const DEFAULT_DESKTOP_RESPONSIVE_PROFILE = Object.freeze(
  createSurfaceResponsiveProfile({
    viewportWidthPx: SURFACE_BREAKPOINTS.desktopComfortableMinWidthPx,
  }),
);

