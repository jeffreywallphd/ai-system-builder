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
      if (url.endsWith("/api/v1/image-assets")) {
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
      if (url.endsWith("/content")) {
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
            lifecycle: {
              status: "available",
            },
            ownership: {
              createdAt: "2026-04-08T00:00:00.000Z",
              updatedAt: "2026-04-08T00:00:00.000Z",
            },
          }],
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
});
