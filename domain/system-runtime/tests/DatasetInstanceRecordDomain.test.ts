import { describe, expect, it } from "bun:test";
import {
  createDatasetInstanceImageRecord,
  matchesDatasetInstanceImageRecordQuery,
  normalizeDatasetInstanceImageRecordQuery,
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
        mimeType: "IMAGE/PNG",
        metadata: { source: "camera-a", scene: "base" },
        tags: ["seed"],
        derived: { orientation: "landscape" },
      },
      metadata: {
        ingestionStage: "initial",
      },
      provenance: {
        sourceType: "upload",
        sourceReference: "upload:session-1:file-1",
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
        provenancePatch: {
          sourceSystemId: "system:image",
          sourceRunId: "run:abc",
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
    expect(patched.image.mimeType).toBe("image/png");
    expect(patched.provenance.sourceType).toBe("upload");
    expect(patched.provenance.sourceSystemId).toBe("system:image");
    expect(patched.provenance.sourceRunId).toBe("run:abc");
    expect(patched.mutationVersion).toBe(2);
  });

  it("normalizes optional runtime fields while preserving inspectable defaults", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:optional",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:optional" },
        width: 128,
        height: 128,
        format: "png",
      },
    });

    expect(record.metadata).toEqual({});
    expect(record.image.tags).toEqual([]);
    expect(record.provenance).toEqual({});
    expect(record.mutationVersion).toBe(1);
  });

  it("supports normalized query/filter behavior over image record runtime contracts", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:query",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:query" },
        width: 800,
        height: 600,
        format: "png",
        tags: ["hero"],
        metadata: { source: "camera-a" },
      },
      metadata: {
        stage: "ingest",
      },
    });

    const query = normalizeDatasetInstanceImageRecordQuery({
      format: " PNG ",
      tag: "hero",
      minWidth: 640,
      metadata: {
        source: "camera-a",
      },
    });
    expect(matchesDatasetInstanceImageRecordQuery(record, query)).toBeTrue();
  });
});
