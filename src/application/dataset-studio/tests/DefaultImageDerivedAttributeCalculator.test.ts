import { describe, expect, it } from "bun:test";
import { DefaultImageDerivedAttributeCalculator } from "../services/DefaultImageDerivedAttributeCalculator";

describe("DefaultImageDerivedAttributeCalculator", () => {
  it("calculates derived attributes for landscape images", () => {
    const calculator = new DefaultImageDerivedAttributeCalculator();
    const derived = calculator.calculate({
      width: 1920,
      height: 1080,
      format: "jpeg",
    });

    expect(derived.orientation).toBe("landscape");
    expect(derived.aspectRatio).toBeCloseTo(1.777778, 6);
    expect(derived.pixelCount).toBe(2073600);
    expect(derived.megapixels).toBeCloseTo(2.0736, 4);
    expect(derived.isAnimated).toBeFalse();
  });

  it("calculates derived attributes for portrait images", () => {
    const calculator = new DefaultImageDerivedAttributeCalculator();
    const derived = calculator.calculate({
      width: 1080,
      height: 1920,
      format: "png",
    });

    expect(derived.orientation).toBe("portrait");
    expect(derived.aspectRatio).toBeCloseTo(0.5625, 6);
    expect(derived.isAnimated).toBeFalse();
  });

  it("calculates derived attributes for square images", () => {
    const calculator = new DefaultImageDerivedAttributeCalculator();
    const derived = calculator.calculate({
      width: 512,
      height: 512,
      format: "webp",
    });

    expect(derived.orientation).toBe("square");
    expect(derived.aspectRatio).toBe(1);
  });

  it("degrades safely when dimensions are invalid or missing", () => {
    const calculator = new DefaultImageDerivedAttributeCalculator();
    const invalid = calculator.calculate({
      width: 0,
      height: 256,
      format: "png",
    });
    expect(invalid.orientation).toBeUndefined();
    expect(invalid.aspectRatio).toBeUndefined();
    expect(invalid.isAnimated).toBeFalse();

    const missing = calculator.calculate({
      format: "gif",
    });
    expect(missing.orientation).toBeUndefined();
    expect(missing.aspectRatio).toBeUndefined();
    expect(missing.isAnimated).toBeTrue();
  });
});
