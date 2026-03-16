import { describe, expect, it, mock } from "bun:test";
import { ComfyApiClient } from "../ComfyApiClient";

describe("ComfyApiClient", () => {
  it("builds view urls with optional params", () => {
    const client = new ComfyApiClient({ baseUrl: "http://localhost:8188/" });
    const url = client.buildViewUrl({ filename: "x.png", subfolder: "out", type: "temp" });
    expect(url).toContain("filename=x.png");
    expect(url).toContain("subfolder=out");
    expect(url).toContain("type=temp");
  });

  it("queues prompts using POST", async () => {
    const fetchMock = mock(async () => new Response(JSON.stringify({ prompt_id: "p1" }), { status: 200 }));
    const prev = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new ComfyApiClient({ baseUrl: "http://localhost:8188" });
      const res = await client.queuePrompt({ prompt: {}, client_id: "wf" });
      expect(res.prompt_id).toBe("p1");
    } finally {
      globalThis.fetch = prev;
    }
  });
});
