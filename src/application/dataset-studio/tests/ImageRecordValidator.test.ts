import { describe, expect, it } from "bun:test";
import { AssetId } from "@domain/assets/AssetId";
import { ImageAssetReferenceKinds } from "@domain/dataset-studio/contracts/ImageAssetReference";
import { validateImageRecord, ZodImageRecordValidator } from "../adapters/validation/ImageRecordValidator";

describe("ImageRecordValidator", () => {
  it("validates canonical image records and returns typed contracts", () => {
    const result = validateImageRecord({
      assetRef: {
        assetId: "asset:image:catalog:1",
        assetVersionId: "asset:image:catalog:1:v2",
      },
      width: 1024,
      height: 768,
      format: "PNG",
      mimeType: "IMAGE/PNG",
      metadata: {
        source: "camera",
      },
      tags: ["hero", "homepage"],
      annotations: {
        caption: " Landing hero ",
        labels: ["marketing", "homepage"],
      },
      derived: {
        aspectRatio: 1.3333,
      },
    });

    expect(result.assetRef.assetId).toBeInstanceOf(AssetId);
    expect(result.assetRef.assetId.toString()).toBe("asset:image:catalog:1");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
    expect(result.format).toBe("png");
    expect(result.mimeType).toBe("image/png");
    expect(result.tags).toEqual(["hero", "homepage"]);
    expect(result.annotations?.caption).toBe("Landing hero");
    expect(result.annotations?.labels).toEqual(["marketing", "homepage"]);
    expect(result.metadata.source).toBe("camera");
  });

  it("normalizes tags by trimming and de-duplicating", () => {
    const result = validateImageRecord({
      assetRef: {
        assetId: "asset:image:tags",
      },
      width: 80,
      height: 80,
      format: "png",
      tags: [" hero ", "hero", "detail", " detail "],
    });

    expect(result.tags).toEqual(["hero", "detail"]);
  });

  it("supports lightweight annotations with optional fields omitted", () => {
    const result = validateImageRecord({
      assetRef: {
        assetId: "asset:image:ann-min",
      },
      width: 640,
      height: 480,
      format: "jpeg",
      annotations: {
        note: "Needs crop review",
      },
    });

    expect(result.annotations?.note).toBe("Needs crop review");
    expect(result.annotations?.labels).toBeUndefined();
  });

  it("normalizes structured local-file and external URI references", () => {
    const local = validateImageRecord({
      assetRef: {
        kind: ImageAssetReferenceKinds.localFile,
        path: "C:\\images\\frame.png",
      },
      width: 120,
      height: 80,
      format: "png",
    });

    expect(local.assetRef.kind).toBe(ImageAssetReferenceKinds.localFile);
    if (local.assetRef.kind === ImageAssetReferenceKinds.localFile) {
      expect(local.assetRef.path).toBe("C:\\images\\frame.png");
    }

    const external = validateImageRecord({
      assetRef: "https://example.com/remote.jpg",
      width: 256,
      height: 256,
      format: "jpeg",
    });
    expect(external.assetRef.kind).toBe(ImageAssetReferenceKinds.externalUri);
  });

  it("keeps records without annotations valid for backward compatibility", () => {
    const result = validateImageRecord({
      assetRef: { assetId: "asset:image:legacy" },
      width: 320,
      height: 240,
      format: "png",
      tags: ["legacy"],
    });
    expect(result.annotations).toBeUndefined();
    expect(result.tags).toEqual(["legacy"]);
  });

  it("rejects invalid image records", () => {
    const validator = new ZodImageRecordValidator();

    expect(() => validator.validateImageRecord({
      assetRef: {
        assetId: "not-canonical",
      },
      width: 0,
      height: 768,
      format: "png",
    })).toThrow();

    expect(() => validator.validateImageRecords([
      {
        assetRef: { assetId: "asset:image:one" },
        width: 512,
        height: 512,
        format: "webp",
      },
      {
        assetRef: { assetId: "asset:image:two" },
        width: -4,
        height: 128,
        format: "jpeg",
      },
    ])).toThrow();

    expect(() => validator.validateImageRecord({
      assetRef: { assetId: "asset:image:three" },
      width: 32,
      height: 32,
      format: "png",
      derived: {
        orientation: "sideways",
      },
    })).toThrow();

    expect(() => validator.validateImageRecord({
      assetRef: { assetId: "asset:image:bad-tags" },
      width: 32,
      height: 32,
      format: "png",
      // @ts-expect-error runtime contract validation coverage
      tags: "hero",
    })).toThrow();

    expect(() => validator.validateImageRecord({
      assetRef: { assetId: "asset:image:bad-ann" },
      width: 32,
      height: 32,
      format: "png",
      annotations: {
        region: {
          x: -1,
          y: 2,
          width: 10,
          height: 10,
        },
      },
    })).toThrow();
  });
});

