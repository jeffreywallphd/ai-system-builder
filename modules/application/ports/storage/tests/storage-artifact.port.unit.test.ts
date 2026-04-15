import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createDeleteArtifactRequest,
  createDeleteArtifactSuccessResult,
  createHasArtifactRequest,
  createHasArtifactSuccessResult,
  createRetrieveArtifactRequest,
  createRetrieveArtifactSuccessResult,
  createStoreArtifactRequest,
  createStoreArtifactSuccessResult,
  type DeleteArtifactRequest,
  type DeleteArtifactResult,
  type HasArtifactRequest,
  type HasArtifactResult,
  type RetrieveArtifactRequest,
  type RetrieveArtifactResult,
  type StoreArtifactRequest,
  type StoreArtifactResult,
} from "../../../../contracts/storage";
import type { ContractBoundaryContext } from "../../../../contracts/shared";

import type { ArtifactStoragePort } from "../storage-artifact.port";

describe("ArtifactStoragePort", () => {
  it("keeps a key-based artifact seam with store/retrieve/has/delete operations", () => {
    expectTypeOf<keyof ArtifactStoragePort>().toEqualTypeOf<
      "storeArtifact" | "retrieveArtifact" | "hasArtifact" | "deleteArtifact"
    >();

    expectTypeOf<Parameters<ArtifactStoragePort["storeArtifact"]>[0]>().toExtend<
      StoreArtifactRequest<unknown>
    >();
    expectTypeOf<Parameters<ArtifactStoragePort["retrieveArtifact"]>[0]>().toExtend<
      RetrieveArtifactRequest
    >();
    expectTypeOf<Parameters<ArtifactStoragePort["hasArtifact"]>[0]>().toExtend<
      HasArtifactRequest
    >();
    expectTypeOf<Parameters<ArtifactStoragePort["deleteArtifact"]>[0]>().toExtend<
      DeleteArtifactRequest
    >();

    expectTypeOf<Awaited<ReturnType<ArtifactStoragePort["storeArtifact"]>>>().toEqualTypeOf<
      StoreArtifactResult
    >();
    expectTypeOf<
      Awaited<ReturnType<ArtifactStoragePort["retrieveArtifact"]>>
    >().toEqualTypeOf<RetrieveArtifactResult<unknown>>();
    expectTypeOf<Awaited<ReturnType<ArtifactStoragePort["hasArtifact"]>>>().toEqualTypeOf<
      HasArtifactResult
    >();
    expectTypeOf<Awaited<ReturnType<ArtifactStoragePort["deleteArtifact"]>>>().toEqualTypeOf<
      DeleteArtifactResult
    >();
  });

  it("passes key-based artifact requests through all storage operations", async () => {
    const context: ContractBoundaryContext = {
      requestId: "req-storage-1",
      correlationId: "corr-storage-1",
    };

    const storeRequest = createStoreArtifactRequest(new Uint8Array([1, 2, 3]), {
      descriptor: {
        key: "workspace/ws-42/artifacts/output.json",
        mediaType: "application/json",
      },
      ...context,
    });
    const retrieveRequest = createRetrieveArtifactRequest(
      "workspace/ws-42/artifacts/output.json",
      context,
    );
    const hasRequest = createHasArtifactRequest("workspace/ws-42/artifacts/output.json", context);
    const deleteRequest = createDeleteArtifactRequest(
      "workspace/ws-42/artifacts/output.json",
      context,
    );

    const storeArtifact = vi.fn<ArtifactStoragePort["storeArtifact"]>().mockResolvedValue(
      createStoreArtifactSuccessResult({
        key: storeRequest.descriptor.key ?? "workspace/ws-42/artifacts/output.json",
        mediaType: "application/json",
        sizeBytes: 3,
      }, context),
    );
    const retrieveArtifact = vi.fn<ArtifactStoragePort["retrieveArtifact"]>().mockResolvedValue(
      createRetrieveArtifactSuccessResult(
        {
          key: retrieveRequest.key,
          mediaType: "application/json",
          sizeBytes: 3,
        },
        new Uint8Array([1, 2, 3]),
        context,
      ),
    );
    const hasArtifact = vi.fn<ArtifactStoragePort["hasArtifact"]>().mockResolvedValue(
      createHasArtifactSuccessResult(true, {
        descriptor: {
          key: hasRequest.key,
          mediaType: "application/json",
          sizeBytes: 3,
        },
        ...context,
      }),
    );
    const deleteArtifact = vi.fn<ArtifactStoragePort["deleteArtifact"]>().mockResolvedValue(
      createDeleteArtifactSuccessResult(true, context),
    );

    const port: ArtifactStoragePort = {
      storeArtifact,
      retrieveArtifact,
      hasArtifact,
      deleteArtifact,
    };

    const storeResult = await port.storeArtifact(storeRequest);
    const retrieveResult = await port.retrieveArtifact(retrieveRequest);
    const hasResult = await port.hasArtifact(hasRequest);
    const deleteResult = await port.deleteArtifact(deleteRequest);

    expect(storeArtifact).toHaveBeenCalledWith(storeRequest);
    expect(retrieveArtifact).toHaveBeenCalledWith(retrieveRequest);
    expect(hasArtifact).toHaveBeenCalledWith(hasRequest);
    expect(deleteArtifact).toHaveBeenCalledWith(deleteRequest);

    expect(storeResult.ok).toBe(true);
    expect(storeResult.value.key).toBe("workspace/ws-42/artifacts/output.json");
    expect(retrieveResult.ok).toBe(true);
    expect(retrieveResult.value.descriptor.key).toBe("workspace/ws-42/artifacts/output.json");
    expect(hasResult.ok).toBe(true);
    expect(hasResult.value.exists).toBe(true);
    expect(deleteResult.ok).toBe(true);
    expect(deleteResult.value.deleted).toBe(true);

    expect("record" in storeRequest).toBe(false);
    expect("operation" in retrieveRequest).toBe(false);
    expect("record" in hasRequest).toBe(false);
    expect("operation" in deleteRequest).toBe(false);
  });
});
