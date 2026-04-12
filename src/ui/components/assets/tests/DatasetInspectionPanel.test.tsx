import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DatasetInspectionPanel from "../DatasetInspectionPanel";

describe("DatasetInspectionPanel", () => {
  it("renders empty/loading/ready states", () => {
    const emptyHtml = renderToStaticMarkup(React.createElement(DatasetInspectionPanel, {}));
    const loadingHtml = renderToStaticMarkup(React.createElement(DatasetInspectionPanel, { isLoading: true }));
    const readyHtml = renderToStaticMarkup(React.createElement(DatasetInspectionPanel, {
      model: {
        title: "Image Dataset",
        intent: { id: "media", name: "Media", description: "Media intent", contractVersion: "1.0.0" },
        shapeKind: "image-metadata-records",
        recordStructure: "Expected image records.",
        fields: [{ name: "width", valueType: "number" }],
        validationSummary: { errors: 1, warnings: 0, valid: false },
        validationIssues: [{ code: "missing-width", section: "execution-request", severity: "error", message: "Missing width." }],
        sampleRecords: [{ itemId: "img-1", width: 128 }],
      },
    }));

    expect(emptyHtml).toContain("Run a preview");
    expect(loadingHtml).toContain("Loading schema-aware inspection");
    expect(readyHtml).toContain("Field definitions");
    expect(readyHtml).toContain("Missing width");
  });
});
