import { describe, expect, it, mock } from "bun:test";
import { HuggingFaceApiClient } from "../HuggingFaceApiClient";

describe("HuggingFaceApiClient", () => {
  it("encodes model ids by path segment when resolving model info", async () => {
    const fetchMock = mock(async (url: string | URL | Request) => {
      expect(String(url)).toContain("/api/models/org/my%20model");
      return new Response(JSON.stringify({ id: "org/my model" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const client = new HuggingFaceApiClient({ baseUrl: "https://huggingface.co" });
      const result = await client.getModelInfo("org/my model");
      expect(result?.id).toBe("org/my model");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("returns undefined for a missing model", async () => {
    const fetchMock = mock(async () => {
      return new Response("not found", { status: 404 });
    });

    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const client = new HuggingFaceApiClient();
      const result = await client.getModelInfo("org/missing-model");
      expect(result).toBeUndefined();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
