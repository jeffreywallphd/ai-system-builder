import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePreviewPanel } from "../image-system/ImagePreviewPanel";
import type { ImageUiViewModel } from "../image-system/ImageUiContracts";

const sampleImage: ImageUiViewModel = {
  imageId: "img-1",
  sourceUrl: "https://example.com/source.png",
  title: "Sample",
  metadata: {
    width: 640,
    height: 480,
    format: "png",
  },
  tags: [],
};

describe("ImagePreviewPanel", () => {
  it("renders empty, loading, and error states", () => {
    const emptyHtml = renderToStaticMarkup(React.createElement(ImagePreviewPanel, {
      title: "Preview",
    }));
    const loadingHtml = renderToStaticMarkup(React.createElement(ImagePreviewPanel, {
      title: "Preview",
      loading: true,
      loadingTitle: "Loading source preview",
      loadingMessage: "Loading source preview from the selected dataset record.",
    }));
    const errorHtml = renderToStaticMarkup(React.createElement(ImagePreviewPanel, {
      title: "Preview",
      errorMessage: "Could not load preview.",
    }));

    expect(emptyHtml).toContain("No image selected");
    expect(loadingHtml).toContain("Loading source preview");
    expect(loadingHtml).toContain("selected dataset record");
    expect(errorHtml).toContain("Could not load preview");
  });

  it("renders selected image details through the shared viewer", () => {
    const html = renderToStaticMarkup(React.createElement(ImagePreviewPanel, {
      title: "Preview",
      subtitle: "Created image",
      image: sampleImage,
    }));

    expect(html).toContain("Created image");
    expect(html).toContain("Dimensions");
    expect(html).toContain("640");
  });
});
