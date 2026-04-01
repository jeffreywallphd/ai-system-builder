import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import {
  ZodMediaDatasetValidator,
  ZodMediaRecordValidator,
} from "../adapters/validation/MediaDatasetValidator";

describe("MediaDatasetValidator", () => {
  it("accepts valid canonical image records", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:good",
        assetVersionId: "asset:image:good:v1",
      },
      width: 1024,
      height: 768,
      format: "png",
      metadata: {
        source: "unit-test",
      },
      tags: ["hero", "homepage"],
      annotations: {
        caption: "Homepage hero",
        labels: ["marketing"],
      },
      derived: {
        aspectRatio: 1.333333,
        orientation: "landscape",
        isAnimated: false,
      },
    });

    expect(result.valid).toBeTrue();
    expect(result.issues).toEqual([]);
    expect(result.diagnostics.errorCount).toBe(0);
    expect(result.value?.format).toBe("png");
  });

  it("rejects records with missing width/height", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:missing",
      },
      format: "png",
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "media.record.invalid")).toBeTrue();
  });

  it("rejects records with invalid asset references", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "not-canonical",
      },
      width: 100,
      height: 100,
      format: "png",
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "media.record.invalid")).toBeTrue();
  });

  it("rejects unsupported formats", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:format",
      },
      width: 100,
      height: 100,
      format: "gif",
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "media.format.unsupported")).toBeTrue();
  });

  it("allows optional metadata to be absent", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:metadata-absent",
      },
      width: 200,
      height: 100,
      format: "jpeg",
      tags: [],
    });

    expect(result.valid).toBeTrue();
    expect(result.value?.metadata).toEqual({});
  });

  it("accepts lightweight annotation payloads and keeps records without annotations valid", () => {
    const validator = new ZodMediaRecordValidator();
    const withAnnotations = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:ann-ok",
      },
      width: 640,
      height: 480,
      format: "png",
      annotations: {
        description: "Source frame for training sample.",
        labels: ["source", "reviewed"],
      },
    });
    expect(withAnnotations.valid).toBeTrue();
    expect(withAnnotations.value?.annotations?.description).toBe("Source frame for training sample.");

    const withoutAnnotations = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:no-ann",
      },
      width: 640,
      height: 480,
      format: "png",
    });
    expect(withoutAnnotations.valid).toBeTrue();
    expect(withoutAnnotations.value?.annotations).toBeUndefined();
  });

  it("rejects malformed derived attribute shapes", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:derived",
      },
      width: 200,
      height: 100,
      format: "png",
      derived: {
        orientation: 90,
      },
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "media.record.invalid")).toBeTrue();
  });

  it("rejects malformed annotation payloads", () => {
    const validator = new ZodMediaRecordValidator();
    const result = validator.validateRecord({
      assetRef: {
        assetId: "asset:image:ann-bad",
      },
      width: 200,
      height: 100,
      format: "png",
      annotations: {
        region: {
          x: 2,
          y: 2,
          width: -1,
          height: 5,
        },
      },
    });

    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "media.record.invalid")).toBeTrue();
  });

  it("validates image-metadata-record shapes with normalized diagnostics", () => {
    const validator = new ZodMediaDatasetValidator();
    const shape = createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "item-1",
        imageId: "asset:image:item-1",
        attributes: {
          assetRef: {
            assetId: "asset:image:item-1",
          },
          width: 640,
          height: 360,
          format: "webp",
          derived: {
            aspectRatio: 1.777778,
            orientation: "landscape",
          },
        },
      }],
    });

    const result = validator.validateShape(shape);
    expect(result.valid).toBeTrue();
    expect(result.diagnostics.errorCount).toBe(0);
  });

  it("surfaces inspectable dataset-level errors for malformed candidates", () => {
    const validator = new ZodMediaDatasetValidator();
    const shape = createCanonicalRecordsShape({
      records: [{
        recordId: "r1",
        fields: {
          assetRef: {
            assetId: "asset:image:r1",
          },
          width: 128,
          height: 128,
          format: "bmp",
          derived: {
            orientation: "diagonal",
          },
        },
      }],
    });

    const result = validator.validateShape(shape);
    expect(result.valid).toBeFalse();
    expect(result.diagnostics.errorCount).toBeGreaterThan(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
