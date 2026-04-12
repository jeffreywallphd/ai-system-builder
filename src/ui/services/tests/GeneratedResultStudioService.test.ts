import { afterEach, describe, expect, it, mock } from "bun:test";
import { GeneratedResultStudioService } from "../GeneratedResultStudioService";

const originalFetch = globalThis.fetch;

describe("GeneratedResultStudioService", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists generated results for the current workspace", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => ({
      json: async () => ({
        ok: true,
        data: {
          items: [{
            resultAssetId: "gr-asset-001",
            workspaceId: "workspace-alpha",
            runId: "run-001",
            systemId: "system-001",
            workflowId: "workflow-001",
            outputSlot: "primary",
            status: "preview-ready",
            visibility: "workspace",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T01:00:00.000Z",
            preview: { state: "preview-available", hasPreview: true },
            retrieval: { state: "retrieval-available" },
            lineage: {
              resultAssetId: "gr-asset-001",
              runId: "run-001",
              systemId: "system-001",
              workflowId: "workflow-001",
              outputSlot: "primary",
              inputAssetCount: 1,
              hasWorkflowTemplateVersion: true,
              hasSystemSnapshot: true,
              hasParameterSnapshot: true,
              hasSelectedNode: true,
            },
            reuse: {
              reusableAsWorkflowInput: true,
              logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
              supportedInputPurposes: ["source-image"],
              assetClasses: ["image-asset"],
              mediaClasses: ["image"],
              sourceContext: {
                runId: "run-001",
                workflowId: "workflow-001",
                systemId: "system-001",
                outputSlot: "primary",
                inputAssetCount: 1,
              },
            },
          }],
          pagination: { limit: 10, offset: 0, returned: 1, hasMore: false },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new GeneratedResultStudioService("http://identity.local");
    const response = await service.listGeneratedResults({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-alpha",
      workflowId: "workflow-001",
      limit: 10,
      offset: 0,
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.items[0]?.resultAssetId).toBe("gr-asset-001");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/generated-results?");
  });

  it("requests generated-result preview metadata", async () => {
    const fetchMock = mock(async () => ({
      json: async () => ({
        ok: true,
        data: {
          preview: {
            resultAssetId: "gr-asset-001",
            workspaceId: "workspace-alpha",
            state: "preview-available",
            available: true,
            selected: {
              derivativeId: "preview-1",
              previewKind: "display-safe",
              mediaType: "image/webp",
              previewToken: "preview-token-001",
              contentEndpoint: "/api/v1/generated-results/gr-asset-001/preview/content",
            },
            alternatives: [],
          },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new GeneratedResultStudioService("http://identity.local");
    const response = await service.requestGeneratedResultPreview({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.preview.selected?.previewToken).toBe("preview-token-001");
  });

  it("retrieves a generated-result detail by asset id", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => ({
      json: async () => ({
        ok: true,
        data: {
          result: {
            resultAssetId: "gr-asset-001",
            workspaceId: "workspace-alpha",
            runId: "run-001",
            systemId: "system-001",
            workflowId: "workflow-001",
            outputSlot: "primary",
            status: "preview-ready",
            visibility: "workspace",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T01:00:00.000Z",
            preview: { state: "preview-available", hasPreview: true },
            retrieval: { state: "retrieval-available" },
            lineage: {
              resultAssetId: "gr-asset-001",
              runId: "run-001",
              systemId: "system-001",
              workflowId: "workflow-001",
              outputSlot: "primary",
              inputAssetCount: 1,
              hasWorkflowTemplateVersion: true,
              hasSystemSnapshot: true,
              hasParameterSnapshot: true,
              hasSelectedNode: true,
            },
            reuse: {
              reusableAsWorkflowInput: true,
              logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
              supportedInputPurposes: ["source-image"],
              assetClasses: ["image-asset"],
              mediaClasses: ["image"],
              sourceContext: {
                runId: "run-001",
                workflowId: "workflow-001",
                systemId: "system-001",
                outputSlot: "primary",
                inputAssetCount: 1,
              },
            },
            storage: { storageInstanceId: "storage-alpha" },
            lifecycle: { pendingSince: "2026-01-01T00:00:00.000Z" },
            previewDescriptors: [],
            lineageDetail: { inputAssetIds: ["asset:1"], updatedAt: "2026-01-01T01:00:00.000Z" },
          },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new GeneratedResultStudioService("http://identity.local");
    const response = await service.getGeneratedResult({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.result.resultAssetId).toBe("gr-asset-001");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/generated-results/gr-asset-001?workspaceId=workspace-alpha");
  });

  it("lists generated results scoped by run id", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => ({
      json: async () => ({
        ok: true,
        data: {
          runId: "run-001",
          items: [],
          pagination: { limit: 10, offset: 0, returned: 0, hasMore: false },
        },
      }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new GeneratedResultStudioService("http://identity.local");
    const response = await service.listGeneratedResultsByRun({
      actorUserIdentityId: "user-1",
      workspaceId: "workspace-alpha",
      runId: "run-001",
      limit: 10,
      offset: 0,
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.runId).toBe("run-001");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/image-runs/run-001/generated-results?");
  });

  it("retrieves original generated-result content and base64-encodes bytes", async () => {
    const payload = Uint8Array.from([104, 101, 108, 108, 111]); // hello
    const headers = new Headers({
      "content-type": "image/png",
      "content-disposition": "attachment; filename=\"generated-result.png\"",
    });
    const fetchMock = mock(async () => ({
      ok: true,
      headers,
      arrayBuffer: async () => payload.buffer,
      json: async () => ({ ok: true }),
    }) as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new GeneratedResultStudioService("http://identity.local");
    const response = await service.getGeneratedResultOriginalContent({
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.fileName).toBe("generated-result.png");
    expect(response.data?.mimeType).toBe("image/png");
    expect(response.data?.payloadBase64).toBe("aGVsbG8=");
  });
});
