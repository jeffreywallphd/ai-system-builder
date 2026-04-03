import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageGallerySlider } from "../image-system/ImageGallerySlider";
import type { ImageUiViewModel } from "../image-system/ImageUiContracts";

const items: ReadonlyArray<ImageUiViewModel> = Object.freeze([
  Object.freeze({
    imageId: "img-a",
    sourceUrl: "https://example.com/a.png",
    title: "Result 1",
    subtitle: "4/1/2026",
    metadata: {},
    tags: [],
  }),
  Object.freeze({
    imageId: "img-b",
    sourceUrl: "https://example.com/b.png",
    title: "Result 2",
    subtitle: "4/2/2026",
    metadata: {},
    tags: [],
  }),
]);

describe("ImageGallerySlider", () => {
  it("renders loading, empty, and error states", () => {
    const loadingHtml = renderToStaticMarkup(React.createElement(ImageGallerySlider, {
      title: "Results",
      items: [],
      loading: true,
    }));
    const emptyHtml = renderToStaticMarkup(React.createElement(ImageGallerySlider, {
      title: "Results",
      items: [],
    }));
    const errorHtml = renderToStaticMarkup(React.createElement(ImageGallerySlider, {
      title: "Results",
      items: [],
      errorMessage: "Gallery unavailable.",
    }));

    expect(loadingHtml).toContain("Results is loading");
    expect(emptyHtml).toContain("No images in results");
    expect(errorHtml).toContain("Gallery unavailable");
  });

  it("renders a horizontal gallery with selected item metadata", () => {
    const html = renderToStaticMarkup(React.createElement(ImageGallerySlider, {
      title: "Results",
      items,
      selectedImageId: "img-b",
    }));

    expect(html).toContain("Result 1");
    expect(html).toContain("Result 2");
    expect(html).toContain("2 images");
    expect(html).toContain("aria-selected=\"true\"");
  });
});
