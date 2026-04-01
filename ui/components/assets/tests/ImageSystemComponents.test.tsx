import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBrowserImageUploadIngestionAdapter } from "../image-system/BrowserImageUploadIngestionAdapter";
import { ImageUploadPanel } from "../image-system/ImageUploadPanel";
import { ImageViewer } from "../image-system/ImageViewer";
import { DEFAULT_IMAGE_RENDER_OPTIONS, type ImageUiViewModel } from "../image-system/ImageUiContracts";

describe("image-system components", () => {
  it("maps browser file validation through ingestion policy contracts", () => {
    const adapter = createBrowserImageUploadIngestionAdapter({
      policy: {
        acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
        acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        maxFileSizeBytes: 1024,
        conversion: {
          mode: "forbidden",
          allowedOutputFormats: ["markdown"],
          passThroughExtensions: [".png", ".jpg", ".jpeg", ".webp"],
          passThroughMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        },
      },
    });

    const result = adapter.evaluate({
      files: [
        new File([new Uint8Array(10)], "ok.png", { type: "image/png" }),
        new File([new Uint8Array(10)], "bad.gif", { type: "image/gif" }),
      ],
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maxUploadCount: 2,
    });

    expect(result.acceptedFiles.length).toBe(1);
    expect(result.rejectedFiles.length).toBe(1);
    expect(result.issues.some((issue) => issue.severity === "error")).toBeTrue();
  });

  it("renders upload panel and image viewer with reusable contracts", () => {
    const image: ImageUiViewModel = {
      imageId: "image-1",
      sourceUrl: "https://example.com/image.png",
      title: "Sample image",
      metadata: {
        width: 512,
        height: 320,
        format: "png",
      },
      tags: ["sample"],
    };

    const uploadHtml = renderToStaticMarkup(
      React.createElement(ImageUploadPanel, {
        acceptedMimeTypes: ["image/png", "image/jpeg"],
      }),
    );
    const viewerHtml = renderToStaticMarkup(
      React.createElement(ImageViewer, {
        image,
        renderOptions: {
          ...DEFAULT_IMAGE_RENDER_OPTIONS,
          fitMode: "contain",
          zoomCapability: "buttons",
        },
      }),
    );

    expect(uploadHtml).toContain("Upload images");
    expect(uploadHtml).toContain("Choose files");
    expect(viewerHtml).toContain("Fit: contain");
    expect(viewerHtml).toContain("Dimensions");
  });
});
