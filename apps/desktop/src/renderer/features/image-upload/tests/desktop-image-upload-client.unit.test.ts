import { describe, expect, it, vi } from "vitest";

import { createDesktopImageUploadClient } from "../api/desktopImageUploadClient";

describe("desktop image upload client", () => {
  it("delegates upload requests through preload and maps success into renderer result shape", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      ok: true,
      value: {
        descriptor: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 3,
          },
        },
      },
    });

    window.desktopApi = {
      uploadImage,
      browseArtifacts: async () => ({ ok: true, value: { items: [] } }),
      readArtifactDetail: async () => ({ ok: true, value: { artifact: { locator: { storageKey: "uploads/a.png" }, artifactKind: "image" } } }),
      readArtifactContentDescriptor: async () => ({ ok: true, value: { content: { locator: { storageKey: "uploads/a.png" }, availability: "available", retrieval: "deferred" } } }),
      readArtifactViewerMedia: async () => ({ ok: true, value: { storageKey: "uploads/a.png", bytes: new Uint8Array([1]) } }),
      publishArtifactToRepo: async () => ({ ok: true, value: { provider: "huggingface", repository: "openai/demo", path: "images/a.png", exists: true } }),
    };

    const client = createDesktopImageUploadClient();
    const input = {
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    };

    const response = await client.uploadImage(input);

    expect(uploadImage).toHaveBeenCalledWith(input);
    expect(response).toEqual({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 3,
        },
      },
    });
  });

  it("maps preload failures into renderer-facing error results", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      ok: false,
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });

    window.desktopApi = {
      uploadImage,
      browseArtifacts: async () => ({ ok: true, value: { items: [] } }),
      readArtifactDetail: async () => ({ ok: true, value: { artifact: { locator: { storageKey: "uploads/a.png" }, artifactKind: "image" } } }),
      readArtifactContentDescriptor: async () => ({ ok: true, value: { content: { locator: { storageKey: "uploads/a.png" }, availability: "available", retrieval: "deferred" } } }),
      readArtifactViewerMedia: async () => ({ ok: true, value: { storageKey: "uploads/a.png", bytes: new Uint8Array([1]) } }),
      publishArtifactToRepo: async () => ({ ok: true, value: { provider: "huggingface", repository: "openai/demo", path: "images/a.png", exists: true } }),
    };

    const client = createDesktopImageUploadClient();
    const response = await client.uploadImage({
      fileName: "bad.pdf",
      mediaType: "application/pdf",
      bytes: new Uint8Array([1, 2]),
    });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });
  });
});
