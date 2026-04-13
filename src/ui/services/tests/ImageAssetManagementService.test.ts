import { afterEach, describe, expect, it, mock } from "bun:test";
import { ImageAssetManagementService } from "../ImageAssetManagementService";

const originalFetch = globalThis.fetch;

describe("ImageAssetManagementService", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uploads a source image through create, content upload, and finalize", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/image-assets?workspaceId=workspace-1")) {
        return {
          json: async () => ({
            ok: true,
            data: {
              asset: {
                assetId: "asset:image:uploaded-1",
              },
              upload: {
                uploadSessionId: "upload-session-1",
                uploadEndpoint: "/api/v1/image-assets/asset%3Aimage%3Auploaded-1/uploads/upload-session-1/content",
                uploadMethod: "POST",
              },
            },
          }),
        } as Response;
      }
      if (url.includes("/content?workspaceId=workspace-1")) {
        return {
          json: async () => ({ ok: true, data: { uploadSessionId: "upload-session-1" } }),
        } as Response;
      }
      return {
        json: async () => ({ ok: true, data: { finalizedAt: "2026-04-08T00:00:00.000Z" } }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });

    const uploaded = await service.uploadStudioSourceImage({
      file,
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
    });

    expect(uploaded.ok).toBeTrue();
    expect(uploaded.data?.assetId).toBe("asset:image:uploaded-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/image-assets?workspaceId=workspace-1");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/content?workspaceId=workspace-1");
  });

  it("accepts gif uploads for source images", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/image-assets?workspaceId=workspace-1")) {
        return {
          json: async () => ({
            ok: true,
            data: {
              asset: { assetId: "asset:image:uploaded-gif" },
              upload: {
                uploadSessionId: "upload-session-gif",
                uploadEndpoint: "/api/v1/image-assets/asset%3Aimage%3Auploaded-gif/uploads/upload-session-gif/content",
                uploadMethod: "POST",
              },
            },
          }),
        } as Response;
      }
      return {
        json: async () => ({ ok: true, data: {} }),
      } as Response;
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const file = new File([new Uint8Array([1, 2, 3])], "animated.gif", { type: "image/gif" });

    const uploaded = await service.uploadStudioSourceImage({
      file,
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
    });

    expect(uploaded.ok).toBeTrue();
    expect(uploaded.data?.assetId).toBe("asset:image:uploaded-gif");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects upload requests when workspace id is blank after normalization", async () => {
    const fetchMock = mock(async () => ({
      json: async () => ({ ok: true }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });

    const uploaded = await service.uploadStudioSourceImage({
      file,
      actorUserIdentityId: "user-1",
      workspaceId: "   ",
      sessionToken: "token-1",
    });

    expect(uploaded.ok).toBeFalse();
    expect(uploaded.error?.code).toBe("invalid-request");
    expect(uploaded.error?.message).toContain("workspace");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("lists recent uploaded image assets for the current actor", async () => {
    const fetchMock = mock(async () => ({
      json: async () => ({
        ok: true,
        data: {
          items: [{
            assetId: "asset:image:uploaded-2",
            normalizedFilename: "portrait.png",
            mediaType: "image/png",
            sizeBytes: 2048,
            visibility: "workspace",
            lifecycle: {
              status: "available",
            },
            preview: {
              available: true,
            },
            ownership: {
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          }],
          pagination: {
            limit: 6,
            offset: 0,
            returned: 1,
            hasMore: false,
          },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const listed = await service.listRecentImageAssets({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
      limit: 6,
    });

    expect(listed.ok).toBeTrue();
    expect(listed.data?.[0]?.assetId).toBe("asset:image:uploaded-2");
    expect(listed.data?.[0]?.originalFilename).toBe("portrait.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads original image content for authoritative recent-asset reuse", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = mock(async () => ({
      ok: true,
      headers: new Headers({
        "content-type": "image/png",
        "content-disposition": "attachment; filename=\"reused.png\"",
      }),
      arrayBuffer: async () => bytes.buffer,
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const loaded = await service.getImageAssetOriginalContent({
      assetId: "asset:image:uploaded-2",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
    });

    expect(loaded.ok).toBeTrue();
    expect(loaded.data?.assetId).toBe("asset:image:uploaded-2");
    expect(loaded.data?.fileName).toBe("reused.png");
    expect(loaded.data?.mimeType).toBe("image/png");
    expect(loaded.data?.payloadBase64).toBe("AQIDBA==");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lists image library assets with pagination metadata for browsing", async () => {
    const fetchMock = mock(async () => ({
      json: async () => ({
        ok: true,
        data: {
          items: [{
            assetId: "asset:image:library-1",
            normalizedFilename: "landscape.webp",
            mediaType: "image/webp",
            sizeBytes: 4096,
            visibility: "workspace",
            lifecycle: {
              status: "available",
            },
            preview: {
              available: true,
            },
            ownership: {
              createdAt: "2026-04-07T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          }],
          pagination: {
            limit: 12,
            offset: 0,
            returned: 1,
            hasMore: true,
          },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://identity.local");
    const listed = await service.listImageLibraryImageAssets({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
      search: "land",
      limit: 12,
      offset: 0,
    });

    expect(listed.ok).toBeTrue();
    expect(listed.data?.items[0]?.assetId).toBe("asset:image:library-1");
    expect(listed.data?.items[0]?.previewAvailable).toBeTrue();
    expect(listed.data?.pagination.hasMore).toBeTrue();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a structured error when list requests fail before receiving a response", async () => {
    const fetchMock = mock(async () => {
      throw new TypeError("Failed to fetch");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new ImageAssetManagementService("http://127.0.0.1:51037");
    const listed = await service.listImageLibraryImageAssets({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-1",
      sessionToken: "token-1",
      limit: 12,
      offset: 0,
    });

    expect(listed.ok).toBeFalse();
    expect(listed.error?.code).toBe("temporarily-unavailable");
    expect(listed.error?.message).toBe("Unable to reach the image service.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
