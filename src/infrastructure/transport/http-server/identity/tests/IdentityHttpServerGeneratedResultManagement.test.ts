import { afterEach, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import { createIdentityHttpServer } from "../IdentityHttpServer";
import type { GeneratedResultManagementBackendApi } from "../../../../api/generated-results/GeneratedResultManagementBackendApi";
import type {
  OpenGeneratedResultPreviewContentStreamApiRequest,
  OpenGeneratedResultOriginalContentStreamApiRequest,
  RequestGeneratedResultPreviewApiRequest,
} from "../../../../api/generated-results/sdk/PublicGeneratedResultManagementApiContract";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));
});

class StubGeneratedResultManagementBackendApi {
  public lastRequest: OpenGeneratedResultOriginalContentStreamApiRequest | undefined;
  public lastPreviewRequest: RequestGeneratedResultPreviewApiRequest | undefined;
  public lastPreviewOpenRequest: OpenGeneratedResultPreviewContentStreamApiRequest | undefined;
  public denyAccess = false;

  public async openGeneratedResultOriginalContentStream(request: OpenGeneratedResultOriginalContentStreamApiRequest) {
    this.lastRequest = request;

    if (this.denyAccess) {
      return {
        ok: false as const,
        error: Object.freeze({
          code: "forbidden" as const,
          message: "Forbidden.",
        }),
      };
    }

    return {
      ok: true as const,
      data: Object.freeze({
        resultAssetId: request.resultAssetId,
        workspaceId: request.workspaceId,
        mimeType: "image/png",
        sizeBytes: 5,
        contentDisposition: "attachment" as const,
        contentDispositionFileName: "generated-result.png",
        stream: (async function* stream() {
          yield Buffer.from("hello", "utf8");
        })(),
      }),
    };
  }

  public async requestGeneratedResultPreview(request: RequestGeneratedResultPreviewApiRequest) {
    this.lastPreviewRequest = request;

    if (this.denyAccess) {
      return {
        ok: false as const,
        error: Object.freeze({
          code: "forbidden" as const,
          message: "Forbidden.",
        }),
      };
    }

    return {
      ok: true as const,
      data: Object.freeze({
        preview: Object.freeze({
          resultAssetId: request.resultAssetId,
          workspaceId: request.workspaceId,
          state: "preview-available" as const,
          available: true,
          selected: Object.freeze({
            derivativeId: "gr-preview-001",
            previewKind: "display-safe" as const,
            mediaType: "image/webp",
            previewToken: "gr-preview-token-001",
            contentEndpoint: `/api/v1/generated-results/${encodeURIComponent(request.resultAssetId)}/preview/content`,
          }),
          alternatives: Object.freeze([]),
        }),
      }),
    };
  }

  public async openGeneratedResultPreviewContentStream(request: OpenGeneratedResultPreviewContentStreamApiRequest) {
    this.lastPreviewOpenRequest = request;

    if (this.denyAccess) {
      return {
        ok: false as const,
        error: Object.freeze({
          code: "invalid-state" as const,
          message: "Preview unavailable.",
        }),
      };
    }

    return {
      ok: true as const,
      data: Object.freeze({
        resultAssetId: request.resultAssetId,
        workspaceId: request.workspaceId,
        mimeType: "image/webp",
        sizeBytes: 5,
        contentDisposition: "inline" as const,
        contentDispositionFileName: "generated-result-preview.webp",
        stream: (async function* stream() {
          yield Buffer.from("hello", "utf8");
        })(),
      }),
    };
  }
}

async function startServer(
  generatedResultBackendApi: StubGeneratedResultManagementBackendApi,
): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    generatedResultManagementBackendApi: generatedResultBackendApi as unknown as GeneratedResultManagementBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return loginBody.data.sessionToken as string;
}

describe("IdentityHttpServer generated-result protected original retrieval", () => {
  it("blocks unauthenticated original-content retrieval requests", async () => {
    const backend = new StubGeneratedResultManagementBackendApi();
    const baseUrl = await startServer(backend);

    const response = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/original?workspaceId=workspace-alpha`,
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("authentication-failed");
  });

  it("streams generated-result original content with protected retrieval headers", async () => {
    const backend = new StubGeneratedResultManagementBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "generated.result.route.success.1");

    const response = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/original?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("hello");

    expect(backend.lastRequest?.workspaceId).toBe("workspace-alpha");
    expect(backend.lastRequest?.resultAssetId).toBe("gr-asset-001");
    expect(backend.lastRequest?.actorUserIdentityId).toBeDefined();
  });

  it("returns forbidden for unauthorized callers without leaking storage paths", async () => {
    const backend = new StubGeneratedResultManagementBackendApi();
    backend.denyAccess = true;
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "generated.result.route.forbidden.1");

    const response = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/original?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("forbidden");
    expect(JSON.stringify(payload)).not.toContain("storage-instance://");
    expect(JSON.stringify(payload)).not.toContain("generated-results/");
  });

  it("returns protected preview metadata and then streams preview content", async () => {
    const backend = new StubGeneratedResultManagementBackendApi();
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "generated.result.route.preview.success.1");

    const previewResponse = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/preview?workspaceId=workspace-alpha&preferredPreviewKind=display-safe`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(previewResponse.status).toBe(200);
    const previewPayload = await previewResponse.json();
    expect(previewPayload.ok).toBe(true);
    expect(previewPayload.data.preview.selected.previewToken).toBe("gr-preview-token-001");

    const contentResponse = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/preview/content?workspaceId=workspace-alpha&previewToken=gr-preview-token-001`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(contentResponse.status).toBe(200);
    expect(contentResponse.headers.get("content-type")).toBe("image/webp");
    expect(contentResponse.headers.get("content-disposition")).toContain("inline");
    expect(contentResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(await contentResponse.text()).toBe("hello");
    expect(backend.lastPreviewRequest?.resultAssetId).toBe("gr-asset-001");
    expect(backend.lastPreviewOpenRequest?.previewToken).toBe("gr-preview-token-001");
  });

  it("returns invalid state for stale or unavailable preview tokens", async () => {
    const backend = new StubGeneratedResultManagementBackendApi();
    backend.denyAccess = true;
    const baseUrl = await startServer(backend);
    const token = await registerAndLogin(baseUrl, "generated.result.route.preview.invalid.1");

    const response = await fetch(
      `${baseUrl}/api/v1/generated-results/${encodeURIComponent("gr-asset-001")}/preview/content?workspaceId=workspace-alpha&previewToken=invalid-token`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(422);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("invalid-state");
    expect(JSON.stringify(payload)).not.toContain("storage-instance://");
  });
});
