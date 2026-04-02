import { describe, expect, it } from "bun:test";
import {
  mapViewportSectionBoundsToStyle,
  normalizeViewportSectionBounds,
} from "../SystemPageLayoutInterpretation";

describe("SystemPageLayoutInterpretation", () => {
  it("keeps section bounds inside the usable viewport occupancy range", () => {
    const bounds = normalizeViewportSectionBounds({
      x: 0.92,
      y: 0.95,
      width: 0.3,
      height: 0.2,
    });

    expect(bounds).toEqual({
      x: 0.7,
      y: 0.8,
      width: 0.3,
      height: 0.2,
    });
  });

  it("maps normalized section occupancy into runtime-safe style calculations", () => {
    const style = mapViewportSectionBoundsToStyle({
      bounds: {
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.4,
      },
    });

    expect(style.left).toBe("calc(10% + (var(--space-sm) * 0.5))");
    expect(style.top).toBe("calc(20% + (var(--space-sm) * 0.5))");
    expect(style.width).toBe("max(48px, calc(50% - var(--space-sm)))");
    expect(style.height).toBe("max(48px, calc(40% - var(--space-sm)))");
  });
});
