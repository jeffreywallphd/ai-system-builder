import { describe, expect, it } from "bun:test";
import {
  createCanonicalImageMetadataRecordsShape,
  createCanonicalRecordsShape,
} from "../../../domain/dataset-studio/CanonicalDataShapes";
import { MediaSchemaIntentAdapter } from "../adapters/schema-intents/MediaSchemaIntentAdapter";

describe("MediaSchemaIntentAdapter", () => {
  it("accepts valid canonical image records", () => {
    const adapter = new MediaSchemaIntentAdapter();
    const shape = createCanonicalRecordsShape({
      records: [{
        recordId: "image-1",
        fields: {
          assetRef: {
            assetId: "asset:image:primary",
            assetVersionId: "asset:image:primary:v1",
          },
          width: 256,
          height: 256,
          format: "png",
          tags: ["thumbnail"],
          annotations: {
            note: "Primary sample",
            labels: ["curated"],
          },
          metadata: {
            source: "unit-test",
          },
          derived: {
            megapixels: 0.065,
          },
        },
      }],
    });

    const result = adapter.validateShape(shape);
    expect(result.valid).toBeTrue();
    expect(result.issues).toEqual([]);
  });

  it("returns warning for image metadata shapes missing canonical image-record fields", () => {
    const adapter = new MediaSchemaIntentAdapter();
    const shape = createCanonicalImageMetadataRecordsShape({
      items: [{
        itemId: "item-1",
        imageId: "asset:image:sample",
      }],
    });

    const result = adapter.validateShape(shape);
    expect(result.valid).toBeTrue();
    expect(result.issues[0]?.severity).toBe("warning");
  });

  it("rejects malformed media records", () => {
    const adapter = new MediaSchemaIntentAdapter();
    const shape = createCanonicalRecordsShape({
      records: [{
        recordId: "image-invalid",
        fields: {
          assetRef: {
            assetId: "asset:image:bad",
          },
          width: -10,
          height: 100,
          format: "jpeg",
        },
      }],
    });

    const result = adapter.validateShape(shape);
    expect(result.valid).toBeFalse();
    expect(result.issues.some((issue) => issue.code === "schema-intent.media.record.invalid")).toBeTrue();
  });
});
