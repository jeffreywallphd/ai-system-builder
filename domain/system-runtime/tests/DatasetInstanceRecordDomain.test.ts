import { describe, expect, it } from "bun:test";
import {
  createDatasetInstanceImageRecord,
  matchesDatasetInstanceImageRecordQuery,
  normalizeDatasetInstanceImageRecordQuery,
  patchDatasetInstanceImageRecord,
  DatasetInstanceImageGenerationRoles,
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

  it("supports partial tag mutation updates", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:tag-patch",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:query" },
        width: 320,
        height: 320,
        format: "png",
        tags: ["seed", "base"],
      },
    });

    const patched = patchDatasetInstanceImageRecord({
      record,
      patch: {
        imagePatch: {
          tagsPatch: {
            add: ["hero"],
            remove: ["base"],
          },
        },
      },
    });
    expect(patched.image.tags).toEqual(["seed", "hero"]);
  });

  it("models generated output linkage as first-class image record generation metadata", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:generation",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:generated:1" },
        width: 1024,
        height: 1024,
        format: "png",
      },
      generation: {
        outputAssetRef: { assetId: "asset:image:generated:1" },
        sourceImageRef: { assetId: "asset:image:source:1" },
        workflowAssetId: "asset:workflow:image-upscale",
        workflowAssetVersionId: "v2",
        runId: "run:image:42",
        role: DatasetInstanceImageGenerationRoles.variant,
        metadata: { scheduler: "karras" },
        tags: ["variant", "hero"],
      },
    });

    expect(record.generation?.runId).toBe("run:image:42");
    expect(record.generation?.workflowAssetId).toBe("asset:workflow:image-upscale");
    expect(record.generation?.role).toBe("variant");
    expect(record.generation?.tags).toEqual(["variant", "hero"]);
  });

  it("supports richer image query filters for mime, tags, identifiers, metadata, and derived fields", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:advanced-query",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:advanced-query" },
        width: 1920,
        height: 1080,
        format: "png",
        mimeType: "image/png",
        tags: ["hero", "featured"],
        metadata: { source: "camera-z" },
        derived: { orientation: "landscape" },
      },
      storage: {
        reference: "prepared://record:image:advanced-query",
      },
    });

    const query = normalizeDatasetInstanceImageRecordQuery({
      mimeType: " IMAGE/PNG ",
      tagsAny: ["featured", "other"],
      tagsAll: ["hero"],
      recordIds: ["record:image:advanced-query"],
      storageReference: "prepared://record:image:advanced-query",
      metadata: { source: "camera-z" },
      derived: { orientation: "landscape" },
    });
    expect(matchesDatasetInstanceImageRecordQuery(record, query)).toBeTrue();
  });

  it("supports patching generation metadata/tags without mutating base image contracts", () => {
    const record = createDatasetInstanceImageRecord({
      recordId: "record:image:generation-patch",
      instanceId: "dataset-instance:1",
      systemId: "system:image",
      datasetAssetId: "asset:image-dataset",
      image: {
        assetRef: { assetId: "asset:image:generated:2" },
        width: 640,
        height: 640,
        format: "png",
      },
      generation: {
        outputAssetRef: { assetId: "asset:image:generated:2" },
        workflowAssetId: "asset:workflow:image-edit",
        runId: "run:image:100",
        role: DatasetInstanceImageGenerationRoles.primary,
        metadata: { steps: 20 },
        tags: ["primary"],
      },
    });

    const patched = patchDatasetInstanceImageRecord({
      record,
      patch: {
        generationPatch: {
          role: DatasetInstanceImageGenerationRoles.intermediate,
          metadataPatch: { set: { steps: 30, seed: 1234 } },
          tagsPatch: { add: ["intermediate"] },
        },
      },
    });

    expect(patched.generation?.role).toBe("intermediate");
    expect(patched.generation?.metadata.steps).toBe(30);
    expect(patched.generation?.metadata.seed).toBe(1234);
    expect(patched.generation?.tags).toEqual(["primary", "intermediate"]);
  });
});
