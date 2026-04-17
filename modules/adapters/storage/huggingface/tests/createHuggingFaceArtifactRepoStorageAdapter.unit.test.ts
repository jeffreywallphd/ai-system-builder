import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  createHasArtifactInRepoRequest,
  createRetrieveArtifactFromRepoRequest,
  createStoreArtifactInRepoRequest,
} from "../../../../contracts/storage";
import { createHuggingFaceArtifactRepoStorageAdapter } from "../createHuggingFaceArtifactRepoStorageAdapter";

describe("createHuggingFaceArtifactRepoStorageAdapter", () => {
  it("validates provider = huggingface", async () => {
    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation: testDouble.fn(async () =>
        new Response(null, { status: 200 })) as unknown as typeof fetch,
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
    const adapter = createHuggingFaceArtifactRepoStorageAdapter();

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

  it("maps hasArtifactInRepo HEAD 200 to exists=true and 404 to exists=false", async () => {
    const responses = [
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": "3",
        },
      }),
      new Response(null, { status: 404 }),
    ];

    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImplementation = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init]);
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected fetch call");
      }
      return response;
    }) as typeof fetch;

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation,
      accessToken: "token-123",
    });

    const existsResult = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        revision: "main",
        path: "image.png",
      }),
    );

    const missingResult = await adapter.hasArtifactInRepo(
      createHasArtifactInRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        revision: "main",
        path: "missing.png",
      }),
    );

    expect(existsResult.ok).toBe(true);
    expect(missingResult.ok).toBe(true);
    if (!existsResult.ok || !missingResult.ok) {
      throw new Error("Expected success results.");
    }

    expect(existsResult.value.exists).toBe(true);
    expect(missingResult.value.exists).toBe(false);

    expect(calls[1]?.[0]).toContain("/resolve/main/missing.png");
    expect(calls[1]?.[1]?.method).toBe("HEAD");
    expect((calls[1]?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("uses commit API for storeArtifactInRepo and requires token", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImplementation = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init]);
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const withoutToken = createHuggingFaceArtifactRepoStorageAdapter({ fetchImplementation });
    const missingTokenResult = await withoutToken.storeArtifactInRepo(
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

    const withToken = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation,
      accessToken: "token-abc",
    });

    const stored = await withToken.storeArtifactInRepo(
      createStoreArtifactInRepoRequest(new Uint8Array([1, 2, 3]), {
        target: {
          provider: "huggingface",
          repository: "datasets/openai/demo",
          revision: "main",
          path: "artifacts/a.bin",
        },
      }),
    );

    expect(stored.ok).toBe(true);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toContain("/api/datasets/openai/demo/commit/main");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");

    const body = JSON.parse(String(init.body));
    expect(body.operations[0]).toMatchObject({
      operation: "addOrUpdate",
      pathInRepo: "artifacts/a.bin",
      encoding: "base64",
    });
  });

  it("maps provider statuses to stable contract codes", async () => {
    const responses = [
      new Response(null, { status: 404 }),
      new Response(null, { status: 401 }),
      new Response(null, { status: 500 }),
    ];

    const fetchImplementation = (async () => {
      const response = responses.shift();
      if (!response) {
        throw new Error("Unexpected fetch call");
      }
      return response;
    }) as typeof fetch;

    const adapter = createHuggingFaceArtifactRepoStorageAdapter({
      fetchImplementation,
      accessToken: "token",
    });

    const notFound = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "missing.bin",
      }),
    );
    const unauthorized = await adapter.retrieveArtifactFromRepo(
      createRetrieveArtifactFromRepoRequest({
        provider: "huggingface",
        repository: "openai/demo",
        path: "private.bin",
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
    expect(unauthorized.ok).toBe(false);
    expect(unavailable.ok).toBe(false);
    if (notFound.ok || unauthorized.ok || unavailable.ok) {
      throw new Error("Expected failures.");
    }

    expect(notFound.error.code).toBe("not-found");
    expect(unauthorized.error.code).toBe("unavailable");
    expect(unavailable.error.code).toBe("unavailable");
  });
});
