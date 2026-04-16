import { describe, expect, it } from "vitest";

import * as storageContracts from "..";

describe("storage family invariants", () => {
  it("exports only storage-family surfaces from the family barrel", () => {
    expect(Object.keys(storageContracts).sort()).toEqual([
      "STORAGE_ARTIFACT_KEY_FORMAT_DESCRIPTION",
      "createDeleteArtifactFailureResult",
      "createDeleteArtifactRequest",
      "createDeleteArtifactSuccessResult",
      "createHasArtifactFailureResult",
      "createHasArtifactRequest",
      "createHasArtifactSuccessResult",
      "createRetrieveArtifactFailureResult",
      "createRetrieveArtifactRequest",
      "createRetrieveArtifactSuccessResult",
      "createStoreArtifactFailureResult",
      "createStoreArtifactRequest",
      "createStoreArtifactSuccessResult",
      "isStorageInstanceKind",
      "isStorageZoneKind",
      "isStorageArtifactKey",
      "normalizeStorageArtifactKey",
      "normalizeStorageInstanceKind",
      "normalizeStorageInstanceReference",
      "normalizeStorageObjectDescriptor",
      "normalizeStorageObjectDescriptorInput",
      "normalizeStoragePlacementDescriptor",
      "normalizeStorageZoneKind",
    ]);
  });

  it("keeps descriptor and request semantics key-based and path-agnostic", () => {
    const descriptor = storageContracts.normalizeStorageObjectDescriptor({
      key: " artifacts/build/output-1 ",
      mediaType: "application/json",
      sizeBytes: 256,
      checksum: {
        algorithm: "sha256",
        value: "abc123",
      },
    });

    expect(descriptor).toEqual({
      key: "artifacts/build/output-1",
      mediaType: "application/json",
      sizeBytes: 256,
      checksum: {
        algorithm: "sha256",
        value: "abc123",
      },
    });

    const request = storageContracts.createRetrieveArtifactRequest(
      " artifacts/build/output-1 ",
      {
        requestId: "req-1",
      },
    );

    expect(request).toEqual({
      key: "artifacts/build/output-1",
      requestId: "req-1",
      correlationId: undefined,
    });
  });

  it("enforces request/result operation expectations without generic CRUD drift", () => {
    const storeRequest = storageContracts.createStoreArtifactRequest(
      new Uint8Array([1, 2]),
      {
        descriptor: {
          key: " artifacts/new-asset ",
        },
      },
    );
    const hasResult = storageContracts.createHasArtifactSuccessResult(false);
    const deleteResult = storageContracts.createDeleteArtifactSuccessResult(true);

    expect(storeRequest).toEqual({
      descriptor: {
        key: "artifacts/new-asset",
      },
      content: new Uint8Array([1, 2]),
      overwrite: undefined,
      requestId: undefined,
      correlationId: undefined,
    });
    expect(hasResult).toEqual({
      ok: true,
      value: {
        exists: false,
        descriptor: undefined,
      },
      requestId: undefined,
      correlationId: undefined,
    });
    expect(deleteResult).toEqual({
      ok: true,
      value: {
        deleted: true,
      },
      requestId: undefined,
      correlationId: undefined,
    });
  });
});
