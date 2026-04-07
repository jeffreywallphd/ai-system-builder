import { describe, expect, it } from "bun:test";
import { areViewportSectionsOverlapping } from "../SystemPageLayoutInterpretation";

describe("SystemPageLayoutInterpretation", () => {
  it("treats touching section edges as non-overlapping", () => {
    const overlaps = areViewportSectionsOverlapping({
      a: Object.freeze({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }),
      b: Object.freeze({ x: 0.3, y: 0.1, width: 0.2, height: 0.2 }),
    });

    expect(overlaps).toBeFalse();
  });

  it("detects overlapping section occupancy", () => {
    const overlaps = areViewportSectionsOverlapping({
      a: Object.freeze({ x: 0.1, y: 0.1, width: 0.4, height: 0.3 }),
      b: Object.freeze({ x: 0.35, y: 0.25, width: 0.4, height: 0.3 }),
    });

    expect(overlaps).toBeTrue();
  });
});
