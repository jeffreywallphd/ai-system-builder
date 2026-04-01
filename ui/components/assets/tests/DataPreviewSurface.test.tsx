import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DataPreviewSurface from "../DataPreviewSurface";
import { DataPreviewEngine } from "../../../../application/data-studio/DataPreviewEngine";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
} from "../../../../domain/dataset-studio/CanonicalDataShapes";

describe("DataPreviewSurface", () => {
  it("renders records/table/text/image previews", () => {
    const engine = new DataPreviewEngine();
    const recordsPreview = engine.buildFromCanonicalShape(createCanonicalRecordsShape({
      records: [{ recordId: "record-1", fields: { name: "Ada" } }],
    }));
    const tablePreview = engine.buildFromCanonicalShape(createCanonicalTableShape({
      columns: [{ columnId: "name", label: "Name", valueType: "string" }],
      rows: [{ rowId: "row-1", cells: { name: "Ada" } }],
    }));
    const textPreview = engine.buildFromCanonicalShape(createCanonicalTextItemsShape({
      items: [{ itemId: "item-1", text: "hello world" }],
    }));
    const imagePreview = engine.buildFromCanonicalShape(createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-1",
        attributes: {
          assetRef: {
            assetId: "asset:image:invoice",
          },
          width: 512,
          height: 320,
          format: "png",
          tags: ["invoice"],
          derived: {
            orientation: "landscape",
          },
        },
      }],
    }));

    const recordsHtml = renderToStaticMarkup(React.createElement(DataPreviewSurface, { preview: recordsPreview }));
    const tableHtml = renderToStaticMarkup(React.createElement(DataPreviewSurface, { preview: tablePreview }));
    const textHtml = renderToStaticMarkup(React.createElement(DataPreviewSurface, { preview: textPreview }));
    const imageHtml = renderToStaticMarkup(React.createElement(DataPreviewSurface, { preview: imagePreview }));

    expect(recordsHtml).toContain("record-1");
    expect(tableHtml).toContain("Name");
    expect(textHtml).toContain("item-1");
    expect(imageHtml).toContain("asset:image:invoice");
    expect(imageHtml).toContain("512x320");
    expect(imageHtml).toContain("invoice");
  });

  it("renders graceful image preview fallbacks for missing preview source", () => {
    const engine = new DataPreviewEngine();
    const imagePreview = engine.buildFromCanonicalShape(createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-missing",
        attributes: {
          width: 256,
          format: "jpeg",
        },
      }],
    }));
    const html = renderToStaticMarkup(React.createElement(DataPreviewSurface, { preview: imagePreview }));

    expect(html).toContain("No preview");
    expect(html).toContain("Missing width or height");
  });

  it("renders error previews with diagnostics", () => {
    const html = renderToStaticMarkup(
      React.createElement(DataPreviewSurface, {
        preview: {
          kind: "error",
          message: "Invalid source payload.",
          summary: { totalCount: 0, sampleCount: 0, truncated: false },
          metadata: { schemaVersion: "1.0.0", lineageCount: 0 },
          diagnostics: {
            infoCount: 0,
            warningCount: 0,
            errorCount: 1,
            diagnostics: [{ code: "invalid_input", severity: "error", message: "Invalid source payload." }],
          },
        },
      }),
    );

    expect(html).toContain("Invalid source payload.");
    expect(html).toContain("1 errors");
  });
});
