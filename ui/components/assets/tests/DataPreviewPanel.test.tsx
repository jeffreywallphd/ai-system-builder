import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCanonicalRecordsShape } from "../../../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataAsset } from "../../../../domain/dataset-studio/CanonicalDataAsset";
import { DefaultDataAssetExecutionFramework } from "../../../../application/dataset-studio/DataAssetExecutionFramework";
import DataPreviewPanel from "../DataPreviewPanel";

describe("DataPreviewPanel", () => {
  it("renders empty and loading states", () => {
    const emptyHtml = renderToStaticMarkup(React.createElement(DataPreviewPanel, {}));
    const loadingHtml = renderToStaticMarkup(React.createElement(DataPreviewPanel, { isLoading: true }));

    expect(emptyHtml).toContain("Run conversion/execution");
    expect(loadingHtml).toContain("Loading preview");
  });

  it("renders execution metadata, preview content, and validation issues", async () => {
    const framework = new DefaultDataAssetExecutionFramework({
      executionIdFactory: () => "preview-panel-exec",
      now: () => new Date("2026-03-31T15:00:00.000Z"),
    });
    const asset = new CanonicalDataAsset({
      id: "dataset-preview-panel",
      name: "Preview Panel",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual", location: "dataset://preview-panel" },
      outputShape: createCanonicalRecordsShape({
        records: [{ recordId: "record-1", fields: { id: "1", name: "Ada" } }],
      }),
      composableInputShapeKinds: Object.freeze([]),
    });

    const result = await framework.execute({ asset });
    const html = renderToStaticMarkup(React.createElement(DataPreviewPanel, { executionResult: result }));

    expect(html).toContain("Execution Metadata");
    expect(html).toContain("Validation");
  });
});
