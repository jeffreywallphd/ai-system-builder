import { describe, expect, it } from "vitest";

import * as ingestionContracts from "..";

describe("ingestion family invariants", () => {
  it("exports only ingestion-family surfaces from the family barrel", () => {
    expect(Object.keys(ingestionContracts).sort()).toEqual([
      "INGESTION_SOURCE_KINDS",
      "createRegisterStagedArtifactFailureResult",
      "createRegisterStagedArtifactRequest",
      "createRegisterStagedArtifactSuccessResult",
      "createStagedArtifactDescriptorFromStorageObjectDescriptor",
      "isIngestionSourceKind",
      "normalizeIngestionSourceKind",
      "normalizeStagedArtifactDescriptor",
      "normalizeStagedArtifactDescriptorInput",
      "normalizeStagedArtifactStorageReference",
    ]);
  });

  it("keeps staged-artifact registration semantics transport-neutral and storage-key aligned", () => {
    const request = ingestionContracts.createRegisterStagedArtifactRequest(
      new Uint8Array([1, 2, 3]),
      {
        descriptor: {
          storage: {
            key: " staged/uploads/object-1 ",
          },
          sourceKind: " Upload ",
          originalName: " kitten.png ",
        },
        requestId: "req-ingest-1",
      },
    );

    expect(request).toEqual({
      descriptor: {
        storage: {
          key: "staged/uploads/object-1",
        },
        sourceKind: "upload",
        originalName: "kitten.png",
      },
      content: new Uint8Array([1, 2, 3]),
      overwrite: undefined,
      requestId: "req-ingest-1",
      correlationId: undefined,
    });

    const result = ingestionContracts.createRegisterStagedArtifactSuccessResult({
      storage: {
        key: " staged/uploads/object-1 ",
      },
      sourceKind: " upload ",
      metadata: {
        surface: "test",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        storage: {
          key: "staged/uploads/object-1",
        },
        sourceKind: "upload",
        metadata: {
          surface: "test",
        },
      },
      requestId: undefined,
      correlationId: undefined,
    });
  });
});
