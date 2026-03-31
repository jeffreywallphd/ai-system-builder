import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetStudioDraftPreviewPanel from "../DatasetStudioDraftPreviewPanel";

describe("DatasetStudioDraftPreviewPanel", () => {
  it("renders the asset configuration panel and preview surface wiring", () => {
    const html = renderToStaticMarkup(React.createElement(DatasetStudioDraftPreviewPanel, {
      draftId: "draft-1",
      draftAssetId: "asset-1",
      draftTitle: "Dataset Draft",
      draftContent: "[{\"id\":\"1\"}]",
    }));

    expect(html).toContain("Asset Configuration");
    expect(html).toContain("Unified Ingestion");
    expect(html).toContain("Source Input");
    expect(html).toContain("Ingestion Preview");
    expect(html).toContain("Inspect low-level ingestors");
  });
});
