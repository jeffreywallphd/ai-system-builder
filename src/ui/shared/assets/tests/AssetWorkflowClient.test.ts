import { describe, expect, it } from "bun:test";
import { HttpAssetWorkflowClient } from "../AssetWorkflowClient";

describe("HttpAssetWorkflowClient", () => {
  it("calls list/detail/download/preview/upload endpoints with bearer auth", async () => {
    const requests: Array<{ method: string; url: string; body: string; authorization?: string }> = [];
    (globalThis as typeof globalThis & {
      fetch: (input: string, init?: RequestInit) => Promise<Response>;
    }).fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({
        method: String(init?.method ?? "GET"),
        url: input,
        body: String(init?.body ?? ""),
        authorization: headers?.authorization,
      });

      const url = String(input);
      if (url.includes("/uploads/initiate")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            asset: { assetId: "asset-1" },
            upload: {
              uploadSessionId: "session-1",
              assetId: "asset-1",
              workspaceId: "workspace-1",
              storageInstanceId: "storage-1",
              objectKey: "workspace-1/assets/asset-1/v1",
              area: "output",
              uploadEndpoint: "/api/v1/assets/upload-sessions/session-1/content",
              uploadMethod: "POST",
              expected: { fileName: "test.png", mimeType: "image/png", sizeBytes: 100 },
              expiresAt: "2026-04-06T10:00:00.000Z",
            },
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/downloads/authorize")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            authorization: {
              contractVersion: "asset-transport/v1",
              assetId: "asset-1",
              versionId: "asset-1:v1",
              workspaceId: "workspace-1",
              mimeType: "image/png",
              sizeBytes: 100,
              contentToken: "token-1",
              expiresAt: "2026-04-06T10:00:00.000Z",
            },
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/preview")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            preview: {
              contractVersion: "asset-transport/v1",
              assetId: "asset-1",
              versionId: "asset-1:v1",
              previewAssetId: "asset-1-preview",
            },
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/api/v1/assets/asset-1?")) {
        return new Response(JSON.stringify({
          ok: true,
          data: { asset: { assetId: "asset-1" } },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        ok: true,
        data: {
          items: [],
          pagination: { limit: 20, offset: 0, returned: 0, hasMore: false },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const client = new HttpAssetWorkflowClient("http://127.0.0.1:8788/");

    await client.listAssets({ workspaceId: "workspace-1", limit: 20 }, "token-1");
    await client.getAssetDetail({ workspaceId: "workspace-1", assetId: "asset-1" }, "token-2");
    await client.authorizeDownload({ workspaceId: "workspace-1", assetId: "asset-1", purpose: "download" }, "token-3");
    await client.resolvePreview({ workspaceId: "workspace-1", assetId: "asset-1", preferredMimeTypes: ["image/webp"] }, "token-4");
    await client.initiateUpload({
      workspaceId: "workspace-1",
      assetId: "asset-1",
      storageInstanceId: "storage-1",
      fileName: "test.png",
      mimeType: "image/png",
      sizeBytes: 100,
      area: "output",
    }, "token-5");

    expect(requests.map((entry) => entry.method)).toEqual(["GET", "GET", "POST", "GET", "POST"]);
    expect(requests.map((entry) => entry.url)).toEqual([
      "http://127.0.0.1:8788/api/v1/assets?workspaceId=workspace-1&limit=20",
      "http://127.0.0.1:8788/api/v1/assets/asset-1?workspaceId=workspace-1",
      "http://127.0.0.1:8788/api/v1/assets/asset-1/downloads/authorize?workspaceId=workspace-1",
      "http://127.0.0.1:8788/api/v1/assets/asset-1/preview?workspaceId=workspace-1&preferredMimeType=image%2Fwebp",
      "http://127.0.0.1:8788/api/v1/assets/asset-1/uploads/initiate?workspaceId=workspace-1",
    ]);
    expect(requests[2]?.body).toContain('"purpose":"download"');
    expect(requests[4]?.body).toContain('"storageInstanceId":"storage-1"');
    for (const [index, request] of requests.entries()) {
      expect(request.authorization).toBe(`Bearer token-${index + 1}`);
    }
  });
});
