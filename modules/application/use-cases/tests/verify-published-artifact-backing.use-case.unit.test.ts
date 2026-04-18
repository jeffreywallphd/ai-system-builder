import { describe, expect, it, testDouble } from "../../../testing/node-test";

import { createHasArtifactInRepoSuccessResult } from "../../../contracts/storage";
import type {
  ArtifactRepoStoragePort,
  ArtifactStorageBindingPort,
} from "../../ports/storage";
import { VerifyPublishedArtifactBackingUseCase } from "../verify-published-artifact-backing.use-case";

describe("VerifyPublishedArtifactBackingUseCase", () => {
  it("re-checks remote existence and updates published binding verification metadata", async () => {
    const artifactRepoStorage: ArtifactRepoStoragePort = {
      hasArtifactInRepo: testDouble.fn(async () => createHasArtifactInRepoSuccessResult(false)),
      storeArtifactInRepo: testDouble.fn(),
      retrieveArtifactFromRepo: testDouble.fn(),
    } as unknown as ArtifactRepoStoragePort;

    const artifactBindingStorage: ArtifactStorageBindingPort = {
      readArtifactStorageBindings: testDouble.fn(async () => ({
        ok: true,
        value: {
          bindings: [
            {
              artifactId: "uploads/a.png",
              role: "published",
              createdAt: "2026-04-16T00:00:00.000Z",
              backing: {
                kind: "artifact-repo",
                provider: "huggingface",
                locator: "openai/demo/images/a.png",
                target: {
                  provider: "huggingface",
                  repository: "openai/demo",
                  path: "images/a.png",
                  revision: "main",
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

    const useCase = new VerifyPublishedArtifactBackingUseCase({
      artifactRepoStorage,
      artifactBindingStorage,
      now: () => "2026-04-17T00:00:00.000Z",
    });

    const result = await useCase.execute({ artifactId: "uploads/a.png" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected verify success.");
    }

    expect(result.value).toEqual({
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        path: "images/a.png",
        revision: "main",
        locator: "openai/demo/images/a.png",
      },
      verification: {
        exists: false,
        verifiedAt: "2026-04-17T00:00:00.000Z",
      },
    });
    expect(artifactBindingStorage.upsertArtifactStorageBinding).toHaveBeenCalled();
  });
});
