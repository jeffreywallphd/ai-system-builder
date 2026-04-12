import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageStatusNotice } from "../image-system/ImageStatusNotice";

describe("ImageStatusNotice", () => {
  it("renders user-facing status copy with tone class", () => {
    const html = renderToStaticMarkup(React.createElement(ImageStatusNotice, {
      title: "Loading editor",
      message: "Getting your photos and settings ready.",
      tone: "warning",
      loading: true,
    }));

    expect(html).toContain("Loading editor");
    expect(html).toContain("Getting your photos and settings ready.");
    expect(html).toContain("ui-image-status-notice--warning");
    expect(html).toContain("ui-image-status-notice--loading");
    expect(html).toContain("aria-busy=\"true\"");
  });
});
