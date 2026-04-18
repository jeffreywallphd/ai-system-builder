import { describe, expect, it, testDouble } from "../../../testing/node-test";

import {
  createRetrieveArtifactFromRepoSuccessResult,
  createStoreArtifactSuccessResult,
  type StoreArtifactRequest,
} from "../../../contracts/storage";
import type {
  ArtifactObjectStoragePort,
  ArtifactRepoStoragePort,
  ArtifactStorageBindingPort,
} from "../../ports/storage";
import { LocalizeArtifactFromRepoUseCase } from "../localize-artifact-from-repo.use-case";

describe("LocalizeArtifactFromRepoUseCase", () => {
  it("retrieves imported bytes from repo, stores local object, and writes local+source bindings", async () => {
    const artifactRepoStorage: ArtifactRepoStoragePort = {
      hasArtifactInRepo: testDouble.fn(),
      storeArtifactInRepo: testDouble.fn(),
      retrieveArtifactFromRepo: testDouble.fn(async () => createRetrieveArtifactFromRepoSuccessResult(
        {
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "images/a.png",
            revision: "main",
          },
          mediaType: "image/png",
          sizeBytes: 3,
        },
        new Uint8Array([1, 2, 3]),
      )),
    } as unknown as ArtifactRepoStoragePort;

    const artifactStorage: ArtifactObjectStoragePort = {
      storeArtifact: testDouble.fn(async (request: StoreArtifactRequest<Uint8Array>) => createStoreArtifactSuccessResult({
        key: request.descriptor.key ?? "",
        mediaType: request.descriptor.mediaType,
        sizeBytes: request.content.byteLength,
      })),
      retrieveArtifact: testDouble.fn(),
      hasArtifact: testDouble.fn(),
      deleteArtifact: testDouble.fn(),
    } as unknown as ArtifactObjectStoragePort;

    const artifactBindingStorage: ArtifactStorageBindingPort = {
      readArtifactStorageBindings: testDouble.fn(async () => ({
        ok: true,
        value: {
          bindings: [
            {
              artifactId: "artifacts/20260418000000-local01",
              role: "imported-source",
              createdAt: "2026-04-17T00:00:00.000Z",
              backing: {
                kind: "artifact-repo",
                provider: "huggingface",
                locator: "openai/demo/images/a.png",
                revision: "main",
                target: {
                  provider: "huggingface",
                  repository: "openai/demo",
                  path: "images/a.png",
                  revision: "main",
                },
                verification: {
                  exists: true,
                  verifiedAt: "2026-04-17T00:00:00.000Z",
                },
              },
            },
          ],
        },
      })),
      upsertArtifactStorageBinding: testDouble.fn(async (request) => ({
        ok: true,
        value: { binding: request.binding },
      })),
    } as unknown as ArtifactStorageBindingPort;

    const useCase = new LocalizeArtifactFromRepoUseCase({
      artifactRepoStorage,
      artifactBindingStorage,
      artifactStorage,
      now: () => "2026-04-18T00:00:00.000Z",
    });

    const result = await useCase.execute({
      artifactId: "artifacts/20260418000000-local01",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected localization success.");
    }

    expect(result.value).toMatchObject({
      artifactId: "artifacts/20260418000000-local01",
      localObject: {
        key: "artifacts/20260418000000-local01",
        mediaType: "image/png",
        sizeBytes: 3,
      },
    });
    expect(artifactBindingStorage.upsertArtifactStorageBinding).toHaveBeenCalledTimes(2);
    const importedSourceUpsertCall = (artifactBindingStorage.upsertArtifactStorageBinding as ReturnType<typeof testDouble.fn>)
      .mock.calls
      .find((call) => call[0]?.binding?.role === "imported-source");
    expect(importedSourceUpsertCall?.[0]).toMatchObject({
      binding: {
        role: "imported-source",
        backing: {
          target: {
            repository: "openai/demo",
            path: "images/a.png",
          },
        },
      },
    });
  });
});
