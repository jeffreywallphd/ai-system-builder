import { describe, expect, it } from "bun:test";
import {
  SURFACE_BREAKPOINTS,
  createSurfaceResponsiveProfile,
  toSurfaceViewport,
} from "../responsive";

describe("SurfaceResponsiveTokens", () => {
  it("resolves viewport from canonical breakpoints", () => {
    expect(toSurfaceViewport(390)).toBe("mobile");
    expect(toSurfaceViewport(SURFACE_BREAKPOINTS.mobileMaxWidthPx)).toBe("mobile");
    expect(toSurfaceViewport(834)).toBe("tablet");
    expect(toSurfaceViewport(1440)).toBe("desktop");
  });

  it("maps mobile profile to touch-first stacked conventions", () => {
    const profile = createSurfaceResponsiveProfile({ viewportWidthPx: 430 });
    expect(profile.viewport).toBe("mobile");
    expect(profile.interactionMode).toBe("touch");
    expect(profile.tableLayout).toBe("cards");
    expect(profile.formLayout).toBe("stacked");
    expect(profile.panelLayout).toBe("stacked");
    expect(profile.actionMenuLayout).toBe("sheet");
    expect(profile.minTouchTargetPx).toBe(44);
  });

  it("maps compact desktop profile to collapsed-detail conventions", () => {
    const profile = createSurfaceResponsiveProfile({ viewportWidthPx: 1120 });
    expect(profile.viewport).toBe("desktop");
    expect(profile.density).toBe("compact");
    expect(profile.tableLayout).toBe("rows-compact");
    expect(profile.panelLayout).toBe("split-with-collapsed-detail");
    expect(profile.navigationMode).toBe("inline");
    expect(profile.minTouchTargetPx).toBe(36);
  });
});

