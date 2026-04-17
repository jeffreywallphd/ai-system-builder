import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  createHasArtifactInRepoRequest,
  createRetrieveArtifactFromRepoRequest,
  createStoreArtifactInRepoRequest,
} from "../../../../contracts/storage";
import { createHuggingFaceArtifactRepoStorageAdapter } from "../createHuggingFaceArtifactRepoStorageAdapter";

function createHubClientDouble() {
  return {
    fileExists: testDouble.fn(async () => true),
    uploadFile: testDouble.fn(async () => undefined),
    downloadFile: testDouble.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        "content-type": "image/png",
      },
    })),
  };
}

describe("createHuggingFaceArtifactRepoStorageAdapter", () => {
  it("requires official hub client availability when no hub client is provided", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      officialHubClientLoader: testDouble.fn(async () => {
        throw new Error("module not found");
      }),
    });

    const result = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "a.txt",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected unavailable failure.");
    }

    expect(result.error.code).toBe("unavailable");
    expect(result.error.message).toContain("@huggingface/hub");
  });

  it("validates provider = huggingface", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      hubClient: createHubClientDouble(),
    });

    const result = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "github",
        repository: "openai/demo",
        path: "a.txt",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation failure.");
    }

    expect(result.error.code).toBe("validation");
    expect(String(result.error.details?.reason)).toContain("requires provider");
  });

  it("validates repository-relative path semantics", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      hubClient: createHubClientDouble(),
    });

    const result = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "../secret.txt",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected validation failure.");
    }

    expect(result.error.code).toBe("validation");
  });

  it("uses official hub-client methods for has/store/retrieve", async () => {
    const hubClient = createHubClientDouble();
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      hubClient,
      accessToken: "token-123",
    });

    const hasResult = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "huggingface",
        repository: "datasets/openai/demo",
        revision: "main",
        path: "image.png",
      }),
    );
    const storeResult = await adapter.storeArtifactInRepo(
      createStoreArtifactInRepoRequest(new Uint8Array([1, 2, 3]), {
        target: {
          provider: "huggingface",
          repository: "datasets/openai/demo",
          revision: "main",
          path: "artifacts/a.bin",
        },
      }),
    );
    const retrieveResult = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "datasets/openai/demo",
        revision: "main",
        path: "artifacts/a.bin",
      }),
    );

    expect(hasResult.ok).toBe(true);
    expect(storeResult.ok).toBe(true);
    expect(retrieveResult.ok).toBe(true);
    expect(hubClient.fileExists).toHaveBeenCalledWith({
      repo: { type: "dataset", name: "openai/demo" },
      path: "image.png",
      revision: "main",
      accessToken: "token-123",
    });
    const uploadCall = hubClient.uploadFile.mock.calls[0]?.[0] as {
      repo: { type: string; name: string };
      branch: string;
      accessToken: string;
    };
    expect(uploadCall.repo).toEqual({ type: "dataset", name: "openai/demo" });
    expect(uploadCall.branch).toBe("main");
    expect(uploadCall.accessToken).toBe("token-123");
    expect(hubClient.downloadFile).toHaveBeenCalledWith({
      repo: { type: "dataset", name: "openai/demo" },
      path: "artifacts/a.bin",
      revision: "main",
      accessToken: "token-123",
    });
  });

  it("requires token for store and returns validation", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      hubClient: createHubClientDouble(),
    });

    const missingTokenResult = await adapter.storeArtifactInRepo(
      createStoreArtifactInRepoRequest(new Uint8Array([1]), {
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          revision: "main",
          path: "artifacts/a.bin",
        },
      }),
    );

    expect(missingTokenResult.ok).toBe(false);
    if (missingTokenResult.ok) {
      throw new Error("Expected missing token failure.");
    }
    expect(missingTokenResult.error.code).toBe("validation");
  });

  it("maps provider status errors to explicit contract codes", async () => {
    const hubClient = createHubClientDouble();
    let callCount = 0;
    hubClient.downloadFile = testDouble.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw {
          statusCode: 404,
          message: "Missing file",
        };
      }

      throw {
        statusCode: 503,
        message: "Provider down",
      };
    });

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      hubClient,
      accessToken: "token",
    });

    const notFound = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "missing.bin",
      }),
    );
    const unavailable = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "down.bin",
      }),
    );

    expect(notFound.ok).toBe(false);
    expect(unavailable.ok).toBe(false);
    if (notFound.ok || unavailable.ok) {
      throw new Error("Expected failures.");
    }

    expect(notFound.error.code).toBe("not-found");
    expect(unavailable.error.code).toBe("unavailable");
  });
});
