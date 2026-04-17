import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  createHasArtifactInRepoRequest,
  createRetrieveArtifactFromRepoRequest,
  createStoreArtifactInRepoRequest,
} from "../../../../contracts/storage";
import { createHuggingFaceArtifactRepoStorageAdapter } from "../createHuggingFaceArtifactRepoStorageAdapter";

describe("createHuggingFaceArtifactRepoStorageAdapter", () => {
  it("constructs adapter and validates provider = huggingface", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation: testDouble.fn(async () =>
        new Response(null, { status: 404 })) as unknown as typeof fetch,
    });

    const wrongProviderResult = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "github",
        repository: "openai/demo",
        path: "a.txt",
      }),
    );

    expect(wrongProviderResult.ok).toBe(false);
    if (wrongProviderResult.ok) {
      throw new Error("Expected provider validation failure.");
    }

    expect(wrongProviderResult.error.code).toBe("validation");
    expect(wrongProviderResult.error.message).toContain("failed unexpectedly");
  });

  it("returns exists = true for hasArtifactInRepo on 200 HEAD", async () => {
    const fetchMock = testDouble.fn(async () =>
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "3",
        },
      })) as unknown as typeof fetch;

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation: fetchMock,
      accessToken: "token-123",
    });

    const result = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        revision: "main",
        path: "image.png",
      }),
      { requestId: "req-hf-has" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected hasArtifactInRepo success.");
    }

    expect(result.value.exists).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/resolve/main/image.png");
    expect(init.method).toBe("HEAD");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("stores artifacts with PUT upload path", async () => {
    const fetchMock = testDouble.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation: fetchMock,
    });

    const result = await adapter.storeArtifactInRepo(
      createStoreArtifactInRepoRequest(new Uint8Array([1, 2, 3]), {
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          revision: "main",
          path: "artifacts/a.bin",
        },
        mediaType: "application/octet-stream",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected storeArtifactInRepo success.");
    }

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/datasets/openai/demo/upload/main/artifacts/a.bin");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/octet-stream",
    );
  });

  it("retrieves artifacts from resolve URL", async () => {
    const fetchMock = testDouble.fn(async () =>
      new Response(new Uint8Array([5, 6, 7]), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
        },
      })) as unknown as typeof fetch;

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation: fetchMock,
    });

    const result = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        revision: "main",
        path: "artifacts/a.bin",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected retrieveArtifactFromRepo success.");
    }

    expect([...result.value.content]).toEqual([5, 6, 7]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/resolve/main/artifacts/a.bin");
    expect(init.method).toBe("GET");
  });
});
