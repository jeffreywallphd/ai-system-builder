import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { createHasArtifactInRepoSuccessResult } from "../../../contracts/storage";
import type { ArtifactCatalogAppendPort } from "../../ports/artifact-catalog";
import type {
  ArtifactRepoStoragePort,
  ArtifactStorageBindingPort,
} from "../../ports/storage";
import { RegisterArtifactFromRepoUseCase } from "../register-artifact-from-repo.use-case";
import { ArtifactId } from "../../../domain/artifact";

describe("RegisterArtifactFromRepoUseCase", () => {
  it("verifies remote target and writes imported-source binding + catalog record", async () => {
    const artifactRepoStorage: ArtifactRepoStoragePort = {
      hasArtifactInRepo: testDouble.fn(async () => createHasArtifactInRepoSuccessResult(true)),
      storeArtifactInRepo: testDouble.fn(),
      retrieveArtifactFromRepo: testDouble.fn(),
    } as unknown as ArtifactRepoStoragePort;

    const artifactBindingStorage: ArtifactStorageBindingPort = {
      readArtifactStorageBindings: testDouble.fn(),
      upsertArtifactStorageBinding: testDouble.fn(async (request) => ({
        ok: true,
        value: { binding: request.binding },
      })),
    } as unknown as ArtifactStorageBindingPort;

    const artifactCatalogAppend: ArtifactCatalogAppendPort = {
      appendArtifactCatalogRecord: testDouble.fn(async (request) => ({
        ok: true,
        value: { storageKey: request.record.storageKey },
      })),
    };

    const useCase = new RegisterArtifactFromRepoUseCase({
      artifactRepoStorage,
      artifactBindingStorage,
      artifactCatalogAppend,
      now: () => "2026-04-17T00:00:00.000Z",
      createArtifactId: () => ArtifactId.from("artifacts/20260417000000-import001"),
    });

    const result = await useCase.execute({
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        path: "images/a.png",
      },
      artifactKind: "image",
      mediaType: "image/png",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected register from repo success.");
    }

    expect(result.value.artifactId).toBe("artifacts/20260417000000-import001");
    const upsertCall = (artifactBindingStorage.upsertArtifactStorageBinding as ReturnType<typeof testDouble.fn>).mock.calls[0]?.[0];
    expect(upsertCall).toMatchObject({
      binding: {
        artifactId: "artifacts/20260417000000-import001",
        role: "imported-source",
      },
    });
  });
});

