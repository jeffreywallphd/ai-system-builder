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
      publishArtifactToRepo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
          exists: true,
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
    const createdBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(Array.from(new Uint8Array(await createdBlob.arrayBuffer()))).toEqual([1, 2, 3]);
    expect(mediaUrl).toBe("blob:desktop-preview");
  });

  it("creates media blob from the typed-array view, not the full backing buffer", async () => {
    const backingBytes = new Uint8Array([9, 1, 2, 3, 7]);
    const slicedView = backingBytes.subarray(1, 4);

    window.desktopApi = {
      uploadImage: vi.fn().mockRejectedValue(new Error("unused")),
      browseArtifacts: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
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
          bytes: slicedView,
        },
      }),
      publishArtifactToRepo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
          exists: true,
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

    await client.createArtifactMediaViewUrl({ storageKey: "uploads/cat.png" });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const createdBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(Array.from(new Uint8Array(await createdBlob.arrayBuffer()))).toEqual([1, 2, 3]);
  });

  it("publishes artifact backing through preload publish bridge", async () => {
    window.desktopApi = {
      uploadImage: vi.fn().mockRejectedValue(new Error("unused")),
      browseArtifacts: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      readArtifactDetail: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactContentDescriptor: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactViewerMedia: vi.fn().mockRejectedValue(new Error("unused")),
      publishArtifactToRepo: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
          exists: true,
        },
      }),
    };

    const client = createDesktopArtifactBrowserClient();
    const result = await client.publishArtifactToHuggingFace({
      artifactId: "uploads/cat.png",
      repository: "openai/demo",
      path: "images/cat.png",
      revision: "main",
    });

    expect(window.desktopApi.publishArtifactToRepo).toHaveBeenCalledWith({
      artifactId: "uploads/cat.png",
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        path: "images/cat.png",
        revision: "main",
      },
      mediaType: undefined,
    });
    expect(result.exists).toBe(true);
  });
});
