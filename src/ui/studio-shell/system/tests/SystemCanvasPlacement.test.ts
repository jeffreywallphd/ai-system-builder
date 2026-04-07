import { describe, expect, it } from "bun:test";
import { resolveCenteredNormalizedPlacement } from "../SystemCanvasPlacement";

describe("SystemCanvasPlacement", () => {
  it("centers a new section in the visible viewport", () => {
    const placement = resolveCenteredNormalizedPlacement({
      viewport: Object.freeze({
        center: Object.freeze({ x: 0.5, y: 0.5 }),
        bounds: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
      }),
      nodeSize: Object.freeze({ width: 0.22, height: 0.18 }),
    });
    expect(placement.x).toBeCloseTo(0.39, 6);
    expect(placement.y).toBeCloseTo(0.41, 6);
  });

  it("keeps centered placement within the normalized frame", () => {
    const placement = resolveCenteredNormalizedPlacement({
      viewport: Object.freeze({
        center: Object.freeze({ x: 0.98, y: 0.96 }),
        bounds: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }),
      }),
      nodeSize: Object.freeze({ width: 0.22, height: 0.18 }),
    });
    expect(placement.x).toBeCloseTo(0.78, 6);
    expect(placement.y).toBeCloseTo(0.82, 6);
  });
});
