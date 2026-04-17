import { afterEach, describe, expect, it, vi } from "vitest";

import { getDesktopApi } from "../lib/desktopApi";

describe("desktopApi bridge access", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("returns the preload-exposed desktop API when present", async () => {
    const uploadImage = vi.fn().mockRejectedValue(new Error("not implemented"));
    window.desktopApi = {
      uploadImage,
      browseArtifacts: async () => ({ ok: true, value: { items: [] } }),
      readArtifactDetail: async () => ({ ok: true, value: { artifact: { locator: { storageKey: "uploads/a.png" }, artifactKind: "image" } } }),
      readArtifactContentDescriptor: async () => ({ ok: true, value: { content: { locator: { storageKey: "uploads/a.png" }, availability: "available", retrieval: "deferred" } } }),
      readArtifactViewerMedia: async () => ({ ok: true, value: { storageKey: "uploads/a.png", bytes: new Uint8Array([1]) } }),
      publishArtifactToRepo: async () => ({ ok: true, value: { provider: "huggingface", repository: "openai/demo", path: "images/a.png", exists: true } }),
    };

    const api = getDesktopApi();

    expect(api).toBe(window.desktopApi);
    await expect(
      api.uploadImage({
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("not implemented");
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when preload has not exposed the desktop API", () => {
    expect(() => getDesktopApi()).toThrow("Desktop preload API is unavailable.");
  });
});
