import { describe, expect, it } from "bun:test";
import {
  DEFAULT_IMAGE_RENDER_OPTIONS,
  computeImageLayoutSize,
  createImageElementLoadingProps,
  normalizeImageRenderMetadata,
  resolveImageAvailability,
  resolvePlaceholderState,
} from "../image-system";

describe("Image UI contracts", () => {
  it("provides bounded default render options", () => {
    expect(DEFAULT_IMAGE_RENDER_OPTIONS.fitMode).toBe("contain");
    expect(DEFAULT_IMAGE_RENDER_OPTIONS.lazyLoad).toBe(true);
    expect(DEFAULT_IMAGE_RENDER_OPTIONS.allowSelectionHighlight).toBe(true);
  });
});

describe("Image rendering utilities", () => {
  it("normalizes metadata and derives aspect ratio/orientation", () => {
    const normalized = normalizeImageRenderMetadata({ width: 1920, height: 1080, format: "png" });
    expect(normalized.aspectRatio).toBeCloseTo(1920 / 1080, 8);
    expect(normalized.orientation).toBe("landscape");
  });

  it("computes contain and cover layout sizes", () => {
    const contain = computeImageLayoutSize({
      container: { width: 400, height: 400 },
      metadata: { width: 800, height: 200 },
      fitMode: "contain",
    });
    const cover = computeImageLayoutSize({
      container: { width: 400, height: 400 },
      metadata: { width: 800, height: 200 },
      fitMode: "cover",
    });

    expect(contain).toEqual({ width: 400, height: 100 });
    expect(cover).toEqual({ width: 1600, height: 400 });
  });

  it("resolves placeholder behavior and loading props", () => {
    const placeholder = resolvePlaceholderState({
      behavior: "keep-space",
      availability: "missing-source",
    });
    const loadingProps = createImageElementLoadingProps(DEFAULT_IMAGE_RENDER_OPTIONS);

    expect(placeholder).toEqual({ shouldRenderPlaceholder: true, keepSpace: true });
    expect(loadingProps).toEqual({ loading: "lazy", decoding: "async" });
  });

  it("exposes image availability states from view model context", () => {
    const availability = resolveImageAvailability({
      image: {
        imageId: "img-1",
        sourceUrl: "file:///tmp/a.png",
        metadata: {},
        tags: [],
      },
      isLoading: true,
    });

    expect(availability).toBe("loading");
  });
});
