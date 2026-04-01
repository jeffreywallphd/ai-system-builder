import { describe, expect, it } from "bun:test";
import {
  createDatasetInstanceImageRecord,
  patchDatasetInstanceImageRecord,
} from "../DatasetInstanceRecordDomain";

describe("DatasetInstanceRecordDomain", () => {
  it("applies controlled image record mutation with metadata/tag/derived updates", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:1",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:1" },
        width: 1024,
        height: 768,
        format: "png",
        metadata: { source: "camera-a", scene: "base" },
        tags: ["seed"],
        derived: { orientation: "landscape" },
      },
      metadata: {
        ingestionStage: "initial",
      },
      admittedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      mutationVersion: 1,
    });

    const patched = patchDatasetInstanceImageRecord({
      record,
      patch: {
        imagePatch: {
          tags: ["seed", "hero"],
          metadataPatch: {
            set: { source: "camera-b", quality: "high" },
            remove: ["scene"],
          },
          derived: { orientation: "landscape", megapixels: 0.79 },
        },
        metadataPatch: {
          set: { ingestionStage: "mutated" },
        },
        updatedAt: "2026-04-01T00:01:00.000Z",
      },
    });

    expect(patched.image.tags).toEqual(["seed", "hero"]);
    expect(patched.image.metadata.source).toBe("camera-b");
    expect(patched.image.metadata.scene).toBeUndefined();
    expect(patched.image.metadata.quality).toBe("high");
    expect(patched.image.derived.megapixels).toBe(0.79);
    expect(patched.metadata.ingestionStage).toBe("mutated");
    expect(patched.mutationVersion).toBe(2);
  });
});
