import { afterEach, describe, expect, it, vi } from "vitest";

import { createDesktopArtifactBrowserClient } from "../api/desktopArtifactBrowserClient";

describe("desktop artifact browser client", () => {
  afterEach(() => {
    delete window.desktopApi;
    vi.restoreAllMocks();
  });

  it("uses descriptor operations plus separate media-view retrieval path", async () => {
    window.desktopApi = {
      uploadImage: vi.fn().mockRejectedValue(new Error("unused")),
      browseArtifacts: vi.fn().mockResolvedValue({
        ok: true,
        value: { items: [{ storageKey: "uploads/cat.png", artifactKind: "image" }] },
      }),
      readArtifactDetail: vi.fn().mockResolvedValue({
        ok: true,
        value: { artifact: { locator: { storageKey: "uploads/cat.png" }, artifactKind: "image" } },
      }),
      readArtifactContentDescriptor: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: {
            locator: { storageKey: "uploads/cat.png" },
            availability: "available",
            retrieval: "deferred",
          },
        },
      }),
      readArtifactViewerMedia: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          storageKey: "uploads/cat.png",
          mediaType: "image/png",
          bytes: new Uint8Array([1, 2, 3]),
        },
      }),
    };

    const createObjectURL = vi.fn().mockReturnValue("blob:desktop-preview");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    const client = createDesktopArtifactBrowserClient();

    const items = await client.browseImageArtifacts();
    const detail = await client.readArtifactDetail({ storageKey: "uploads/cat.png" });
    const content = await client.readArtifactContent({ storageKey: "uploads/cat.png" });
    const mediaUrl = await client.createArtifactMediaViewUrl({ storageKey: "uploads/cat.png" });

    expect(items[0].storageKey).toBe("uploads/cat.png");
    expect(detail.locator.storageKey).toBe("uploads/cat.png");
    expect(content.retrieval).toBe("deferred");
    expect(window.desktopApi.readArtifactViewerMedia).toHaveBeenCalledWith({ storageKey: "uploads/cat.png" });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mediaUrl).toBe("blob:desktop-preview");
  });
});
