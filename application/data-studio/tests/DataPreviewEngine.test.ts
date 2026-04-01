import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
  createCanonicalTableShape,
  createCanonicalTextItemsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import { CanonicalDataAsset } from "../../../domain/dataset-studio/CanonicalDataAsset";
import { DataPreviewEngine } from "../DataPreviewEngine";
import { DataConverterOperationKinds, type DataConverterFailureResult } from "../../dataset-studio/DataConverterContracts";

function createEngine(): DataPreviewEngine {
  return new DataPreviewEngine();
}

describe("DataPreviewEngine", () => {
  it("builds sampled records preview from canonical shape", () => {
    const shape = createCanonicalRecordsShape({
      records: [
        { recordId: "record-1", fields: { id: "1", name: "Ada" } },
        { recordId: "record-2", fields: { id: "2", name: "Lin" } },
      ],
      metadata: {
        source: { fileName: "users.json", format: "json" },
      },
    });

    const preview = createEngine().buildFromCanonicalShape(shape, { maxItems: 1 });
    expect(preview.kind).toBe("records");
    if (preview.kind !== "records") {
      throw new Error("expected records preview");
    }

    expect(preview.summary.totalCount).toBe(2);
    expect(preview.summary.sampleCount).toBe(1);
    expect(preview.summary.truncated).toBe(true);
    expect(preview.records[0]?.recordId).toBe("record-1");
    expect(preview.metadata.sourceFileName).toBe("users.json");
  });

  it("maps table columns/rows with column clipping", () => {
    const shape = createCanonicalTableShape({
      columns: [
        { columnId: "c1", label: "C1", valueType: "string" },
        { columnId: "c2", label: "C2", valueType: "string" },
      ],
      rows: [
        { rowId: "row-1", cells: { c1: "a", c2: "b" } },
      ],
    });

    const preview = createEngine().buildFromCanonicalShape(shape, { maxColumns: 1 });
    expect(preview.kind).toBe("table");
    if (preview.kind !== "table") {
      throw new Error("expected table preview");
    }

    expect(preview.columns).toHaveLength(1);
    expect(Object.keys(preview.rows[0]?.cells ?? {})).toEqual(["c1"]);
  });

  it("clips text items and supports image metadata previews", () => {
    const textShape = createCanonicalTextItemsShape({
      items: [{ itemId: "item-1", text: "A long text item for clipping checks in preview." }],
    });

    const textPreview = createEngine().buildFromCanonicalShape(textShape, { maxTextLength: 12 });
    expect(textPreview.kind).toBe("text-items");
    if (textPreview.kind !== "text-items") {
      throw new Error("expected text preview");
    }
    expect(textPreview.items[0]?.text.endsWith("...")).toBe(true);

    const imageShape = createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-1",
        imageId: "asset:image:logo",
        attributes: {
          assetRef: {
            assetId: "asset:image:logo",
          },
          width: 640,
          height: 480,
          format: "png",
          tags: ["logo", "brand"],
          annotations: {
            caption: "Brand logo",
            labels: ["approved"],
          },
          derived: {
            orientation: "landscape",
            aspectRatio: 1.333333,
          },
        },
      }],
    });

    const imagePreview = createEngine().buildFromCanonicalShape(imageShape);
    expect(imagePreview.kind).toBe("image-metadata-records");
    if (imagePreview.kind !== "image-metadata-records") {
      throw new Error("expected image metadata preview");
    }

    expect(imagePreview.items[0]?.imageReference).toBe("asset:image:logo");
    expect(imagePreview.items[0]?.width).toBe(640);
    expect(imagePreview.items[0]?.height).toBe(480);
    expect(imagePreview.items[0]?.format).toBe("png");
    expect(imagePreview.items[0]?.tags).toEqual(["logo", "brand"]);
    expect(imagePreview.items[0]?.annotations).toEqual({
      caption: "Brand logo",
      labels: ["approved"],
    });
  });

  it("builds resilient image previews for partial and malformed records", () => {
    const imageShape = createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-partial",
        imageId: "fallback-image-id",
        attributes: {
          width: 400,
          format: "jpeg",
        },
      }, {
        itemId: "img-malformed",
        attributes: {
          assetRef: {
            assetId: "not-canonical-id",
          },
          width: 0,
          height: 0,
        },
      }],
    });

    const preview = createEngine().buildFromCanonicalShape(imageShape, { maxItems: 2 });
    expect(preview.kind).toBe("image-metadata-records");
    if (preview.kind !== "image-metadata-records") {
      throw new Error("expected image metadata preview");
    }

    expect(preview.summary.sampleCount).toBe(2);
    expect(preview.items[0]?.imageReference).toBe("fallback-image-id");
    expect(preview.items[0]?.height).toBeUndefined();
    expect(preview.items[1]?.issues.length).toBeGreaterThan(0);
    expect(preview.diagnostics.warningCount).toBeGreaterThan(0);
  });

  it("applies bounded sampling to image metadata previews", () => {
    const shape = createCanonicalImageMetadataRecordsShape({
      items: [
        { itemId: "img-1", attributes: { width: 1, height: 1, format: "png" } },
        { itemId: "img-2", attributes: { width: 1, height: 1, format: "png" } },
      ],
    });

    const preview = createEngine().buildFromCanonicalShape(shape, { maxItems: 1 });
    expect(preview.kind).toBe("image-metadata-records");
    if (preview.kind !== "image-metadata-records") {
      throw new Error("expected image metadata preview");
    }
    expect(preview.summary.totalCount).toBe(2);
    expect(preview.summary.sampleCount).toBe(1);
    expect(preview.summary.truncated).toBeTrue();
  });

  it("maps local-file image references to thumbnail sources", () => {
    const shape = createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "img-thumb",
        attributes: {
          assetRef: {
            kind: "local-file",
            path: "C:\\images\\sample.png",
          },
          width: 50,
          height: 50,
          format: "png",
        },
      }],
    });

    const preview = createEngine().buildFromCanonicalShape(shape);
    expect(preview.kind).toBe("image-metadata-records");
    if (preview.kind !== "image-metadata-records") {
      throw new Error("expected image metadata preview");
    }
    expect(preview.items[0]?.thumbnailSource).toBe("file:///C:/images/sample.png");
  });

  it("builds error preview from converter failures with diagnostics", () => {
    const failure: DataConverterFailureResult = Object.freeze({
      ok: false,
      operation: DataConverterOperationKinds.sourceToRecords,
      context: Object.freeze({}),
      diagnostics: Object.freeze([
        Object.freeze({
          code: "invalid_input",
          severity: "error",
          message: "Payload is empty.",
        }),
      ]),
    });

    const preview = createEngine().buildFromConverterResult(failure);
    expect(preview.kind).toBe("error");
    if (preview.kind !== "error") {
      throw new Error("expected error preview");
    }

    expect(preview.message).toContain("Payload is empty");
    expect(preview.diagnostics.errorCount).toBe(1);
  });

  it("builds preview directly from previewable data assets", () => {
    const asset = new CanonicalDataAsset({
      id: "asset-preview",
      name: "Previewable Asset",
      source: { type: "generated", workflowId: "wf-1" },
      location: { accessMethod: "virtual", location: "dataset://preview" },
      outputShape: createCanonicalRecordsShape({
        records: [{ recordId: "r1", fields: { id: "1" } }],
      }),
    });

    const preview = createEngine().buildFromDataAsset(asset);
    expect(preview.kind).toBe("records");
  });
});

