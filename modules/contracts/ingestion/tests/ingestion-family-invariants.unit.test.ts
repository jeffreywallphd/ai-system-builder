import { describe, expect, it } from "vitest";

import * as ingestionContracts from "..";

describe("ingestion family invariants", () => {
  it("exports only ingestion-family surfaces from the family barrel", () => {
    expect(Object.keys(ingestionContracts).sort()).toEqual([
      "INGESTION_SOURCE_KINDS",
      "createRegisterStagedDataFailureResult",
      "createRegisterStagedDataRequest",
      "createRegisterStagedDataSuccessResult",
      "createStagedDataDescriptorFromStorageObjectDescriptor",
      "isIngestionSourceKind",
      "normalizeIngestionSourceKind",
      "normalizeStagedDataDescriptor",
      "normalizeStagedDataDescriptorInput",
    ]);
  });

  it("keeps staged-data registration semantics transport-neutral and storage-key aligned", () => {
    const request = ingestionContracts.createRegisterStagedDataRequest(
      new Uint8Array([1, 2, 3]),
      {
        descriptor: {
          storageKey: " staged/uploads/object-1 ",
          sourceKind: " Upload ",
          mediaType: "image/png",
          originalName: " kitten.png ",
        },
        requestId: "req-ingest-1",
      },
    );

    expect(request).toEqual({
      descriptor: {
        storageKey: "staged/uploads/object-1",
        sourceKind: "upload",
        mediaType: "image/png",
        originalName: "kitten.png",
      },
      content: new Uint8Array([1, 2, 3]),
      overwrite: undefined,
      requestId: "req-ingest-1",
      correlationId: undefined,
    });

    const result = ingestionContracts.createRegisterStagedDataSuccessResult({
      storageKey: " staged/uploads/object-1 ",
      sourceKind: " upload ",
      mediaType: "image/png",
      sizeBytes: 3,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        storageKey: "staged/uploads/object-1",
        sourceKind: "upload",
        mediaType: "image/png",
        sizeBytes: 3,
      },
      requestId: undefined,
      correlationId: undefined,
    });
  });
});
