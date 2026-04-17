import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiArtifactBrowserClient } from "../api/apiArtifactBrowserClient";

describe("api artifact browser client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls browse/detail/content endpoints and maps descriptor-oriented responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            items: [{ storageKey: "uploads/a.png", artifactKind: "image", mediaType: "image/png" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            artifact: {
              locator: { storageKey: "uploads/a.png" },
              artifactKind: "image",
              mediaType: "image/png",
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          ok: true,
          value: {
            content: {
              locator: { storageKey: "uploads/a.png" },
              availability: "available",
              retrieval: "deferred",
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiArtifactBrowserClient({ apiBaseUrl: "/api" });

    const browse = await client.browseImageArtifacts();
    const detail = await client.readArtifactDetail({ storageKey: "uploads/a.png" });
    const content = await client.readArtifactContent({ storageKey: "uploads/a.png" });
    const imageViewUrl = client.createArtifactImageViewUrl({ storageKey: "uploads/a.png" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/artifact/browse",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/artifact/read",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/artifact/content/read",
      expect.objectContaining({ method: "POST" }),
    );

    expect(browse[0].storageKey).toBe("uploads/a.png");
    expect(detail.locator.storageKey).toBe("uploads/a.png");
    expect(content.retrieval).toBe("deferred");
    expect((content as unknown as { bytes?: unknown }).bytes).toBeUndefined();
    expect(imageViewUrl).toBe("/api/artifact/content/view?storageKey=uploads%2Fa.png");
  });
});
