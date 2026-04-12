import { describe, expect, it } from "bun:test";
import {
  GeneratedResultOriginalContentReadErrorCodes,
  type GeneratedResultOriginalContentReadResult,
  type GetGeneratedResultOriginalContentRequest,
  type GetGeneratedResultOriginalContentSuccess,
  type IGetGeneratedResultOriginalContentUseCase,
} from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import {
  GeneratedResultLineageReadErrorCodes,
  type GeneratedResultLineageReadResult,
  type GetGeneratedResultLineageDetailSuccess,
  type GetGeneratedResultLineageRequest,
  type GetGeneratedResultLineageSummarySuccess,
  type IGetGeneratedResultLineageDetailUseCase,
  type IGetGeneratedResultLineageSummaryUseCase,
} from "@application/generated-results/use-cases/GeneratedResultLineageReadUseCaseContracts";
import {
  GeneratedResultPreviewContentReadErrorCodes,
  type GeneratedResultPreviewContentReadResult,
  type IOpenGeneratedResultPreviewContentUseCase,
  type IRequestGeneratedResultPreviewContentUseCase,
  type OpenGeneratedResultPreviewContentRequest,
  type OpenGeneratedResultPreviewContentSuccess,
  type RequestGeneratedResultPreviewContentRequest,
  type RequestGeneratedResultPreviewContentSuccess,
} from "@application/generated-results/use-cases/GetGeneratedResultPreviewContentUseCaseContracts";
import {
  GeneratedResultMetadataReadErrorCodes,
  type GeneratedResultMetadataReadResult,
  type GetGeneratedResultMetadataRequest,
  type GetGeneratedResultMetadataSuccess,
  type IGetGeneratedResultMetadataUseCase,
  type IListGeneratedResultMetadataUseCase,
  type ListGeneratedResultMetadataRequest,
  type ListGeneratedResultMetadataSuccess,
} from "@application/generated-results/use-cases/GeneratedResultMetadataReadUseCaseContracts";
import { GeneratedResultManagementBackendApi } from "../GeneratedResultManagementBackendApi";

class StubGetGeneratedResultOriginalContentUseCase implements IGetGeneratedResultOriginalContentUseCase {
  public mode: "success" | "access-denied" | "invalid-state" = "success";

  public async execute(
    _request: GetGeneratedResultOriginalContentRequest,
  ): Promise<GeneratedResultOriginalContentReadResult<GetGeneratedResultOriginalContentSuccess>> {
    if (this.mode === "access-denied") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultOriginalContentReadErrorCodes.accessDenied,
          message: "Forbidden.",
        }),
      };
    }
    if (this.mode === "invalid-state") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultOriginalContentReadErrorCodes.invalidState,
          message: "Unavailable.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        mediaType: "image/png",
        sizeBytes: 5,
        contentDisposition: "attachment",
        contentDispositionFileName: "gr-asset-001.png",
        stream: (async function* stream() {
          yield Buffer.from("hello", "utf8");
        })(),
      }),
    };
  }
}

class StubRequestGeneratedResultPreviewContentUseCase implements IRequestGeneratedResultPreviewContentUseCase {
  public mode: "success" | "access-denied" | "invalid-state" = "success";

  public async execute(
    _request: RequestGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<RequestGeneratedResultPreviewContentSuccess>> {
    if (this.mode === "access-denied") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultPreviewContentReadErrorCodes.accessDenied,
          message: "Forbidden.",
        }),
      };
    }
    if (this.mode === "invalid-state") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultPreviewContentReadErrorCodes.invalidState,
          message: "Unavailable.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        state: "preview-available",
        available: true,
        selected: Object.freeze({
          derivativeId: "gr-preview-001",
          previewKind: "display-safe",
          availabilityStatus: "available",
          mediaType: "image/webp",
          width: 512,
          height: 512,
          byteSize: 4096,
          previewToken: "preview-token-001",
        }),
        alternatives: Object.freeze([]),
      }),
    };
  }
}

class StubOpenGeneratedResultPreviewContentUseCase implements IOpenGeneratedResultPreviewContentUseCase {
  public mode: "success" | "invalid-state" = "success";

  public async execute(
    _request: OpenGeneratedResultPreviewContentRequest,
  ): Promise<GeneratedResultPreviewContentReadResult<OpenGeneratedResultPreviewContentSuccess>> {
    if (this.mode === "invalid-state") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultPreviewContentReadErrorCodes.invalidState,
          message: "Unavailable.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        mediaType: "image/webp",
        sizeBytes: 5,
        contentDisposition: "inline",
        contentDispositionFileName: "gr-preview.webp",
        stream: (async function* stream() {
          yield Buffer.from("hello", "utf8");
        })(),
      }),
    };
  }
}

class StubGetGeneratedResultLineageSummaryUseCase implements IGetGeneratedResultLineageSummaryUseCase {
  public mode: "success" | "access-denied" = "success";

  public async execute(
    _request: GetGeneratedResultLineageRequest,
  ): Promise<GeneratedResultLineageReadResult<GetGeneratedResultLineageSummarySuccess>> {
    if (this.mode === "access-denied") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultLineageReadErrorCodes.accessDenied,
          message: "Forbidden.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        lineage: Object.freeze({
          resultAssetId: "gr-asset-001",
          runId: "run-001",
          systemId: "system-001",
          workflowId: "workflow-001",
          outputSlot: "primary",
          inputAssetCount: 2,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        }),
      }),
    };
  }
}

class StubGetGeneratedResultLineageDetailUseCase implements IGetGeneratedResultLineageDetailUseCase {
  public mode: "success" | "not-found" = "success";

  public async execute(
    _request: GetGeneratedResultLineageRequest,
  ): Promise<GeneratedResultLineageReadResult<GetGeneratedResultLineageDetailSuccess>> {
    if (this.mode === "not-found") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultLineageReadErrorCodes.notFound,
          message: "Not found.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        lineage: Object.freeze({
          summary: Object.freeze({
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
          }),
          source: Object.freeze({
            workflowTemplateVersionId: "wf-version-1",
            executionAdapterKind: "comfyui",
            executionBackendFamily: "comfyui",
          }),
          upstreamInputs: Object.freeze([Object.freeze({ assetId: "input-asset-001" })]),
          graph: Object.freeze({
            nodes: Object.freeze([Object.freeze({
              nodeId: "lineage-node:result:gr-asset-001",
              nodeType: "result",
              referenceId: "gr-asset-001",
            })]),
            edges: Object.freeze([]),
          }),
        }),
      }),
    };
  }
}

class StubListGeneratedResultMetadataUseCase implements IListGeneratedResultMetadataUseCase {
  public mode: "success" | "invalid-request" = "success";

  public async execute(
    _request: ListGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<ListGeneratedResultMetadataSuccess>> {
    if (this.mode === "invalid-request") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultMetadataReadErrorCodes.invalidRequest,
          message: "Invalid request.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        items: Object.freeze([Object.freeze({
          resultAssetId: "gr-asset-001",
          workspaceId: "workspace-alpha",
          runId: "run-001",
          systemId: "system-001",
          workflowId: "workflow-001",
          outputSlot: "primary",
          status: "preview-ready",
          mediaType: "image/webp",
          visibility: "workspace",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T01:00:00.000Z",
          preview: Object.freeze({
            state: "preview-available",
            hasPreview: true,
            primaryPreviewKind: "display-safe",
            availabilityStatus: "available",
          }),
          retrieval: Object.freeze({
            state: "retrieval-available",
          }),
          lineage: Object.freeze({
            resultAssetId: "gr-asset-001",
            runId: "run-001",
            systemId: "system-001",
            workflowId: "workflow-001",
            outputSlot: "primary",
            inputAssetCount: 2,
            hasWorkflowTemplateVersion: true,
            hasSystemSnapshot: true,
            hasParameterSnapshot: true,
            hasSelectedNode: true,
          }),
          reuse: Object.freeze({
            reusableAsWorkflowInput: true,
            logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
            supportedInputPurposes: Object.freeze(["source-image"]),
            assetClasses: Object.freeze(["image-asset"]),
            mediaClasses: Object.freeze(["image"]),
            sourceContext: Object.freeze({
              runId: "run-001",
              workflowId: "workflow-001",
              systemId: "system-001",
              outputSlot: "primary",
              inputAssetCount: 2,
            }),
          }),
        })]),
        pagination: Object.freeze({
          limit: 25,
          offset: 0,
          returned: 1,
          hasMore: false,
        }),
      }),
    };
  }
}

class StubGetGeneratedResultMetadataUseCase implements IGetGeneratedResultMetadataUseCase {
  public mode: "success" | "not-found" = "success";

  public async execute(
    _request: GetGeneratedResultMetadataRequest,
  ): Promise<GeneratedResultMetadataReadResult<GetGeneratedResultMetadataSuccess>> {
    if (this.mode === "not-found") {
      return {
        ok: false,
        error: Object.freeze({
          code: GeneratedResultMetadataReadErrorCodes.notFound,
          message: "Not found.",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        result: Object.freeze({
          resultAssetId: "gr-asset-001",
          workspaceId: "workspace-alpha",
          runId: "run-001",
          systemId: "system-001",
          workflowId: "workflow-001",
          outputSlot: "primary",
          status: "preview-ready",
          mediaType: "image/webp",
          visibility: "workspace",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T01:00:00.000Z",
          preview: Object.freeze({
            state: "preview-available",
            hasPreview: true,
            primaryPreviewKind: "display-safe",
            availabilityStatus: "available",
          }),
          retrieval: Object.freeze({
            state: "retrieval-available",
          }),
          lineage: Object.freeze({
            resultAssetId: "gr-asset-001",
            runId: "run-001",
            systemId: "system-001",
            workflowId: "workflow-001",
            outputSlot: "primary",
            inputAssetCount: 2,
            hasWorkflowTemplateVersion: true,
            hasSystemSnapshot: true,
            hasParameterSnapshot: true,
            hasSelectedNode: true,
          }),
          reuse: Object.freeze({
            reusableAsWorkflowInput: true,
            logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
            supportedInputPurposes: Object.freeze(["source-image"]),
            assetClasses: Object.freeze(["image-asset"]),
            mediaClasses: Object.freeze(["image"]),
            sourceContext: Object.freeze({
              runId: "run-001",
              workflowId: "workflow-001",
              systemId: "system-001",
              outputSlot: "primary",
              inputAssetCount: 2,
            }),
          }),
          storage: Object.freeze({
            storageInstanceId: "storage-alpha",
          }),
          lifecycle: Object.freeze({
            pendingSince: "2026-01-01T00:00:00.000Z",
          }),
          previewDescriptors: Object.freeze([]),
          lineageDetail: Object.freeze({
            inputAssetIds: Object.freeze(["image-asset-001"]),
            updatedAt: "2026-01-01T01:00:00.000Z",
          }),
        }),
      }),
    };
  }
}

function createApi(input: {
  readonly original?: StubGetGeneratedResultOriginalContentUseCase;
  readonly previewRequest?: StubRequestGeneratedResultPreviewContentUseCase;
  readonly previewOpen?: StubOpenGeneratedResultPreviewContentUseCase;
  readonly lineageSummary?: StubGetGeneratedResultLineageSummaryUseCase;
  readonly lineageDetail?: StubGetGeneratedResultLineageDetailUseCase;
  readonly listMetadata?: StubListGeneratedResultMetadataUseCase;
  readonly getMetadata?: StubGetGeneratedResultMetadataUseCase;
} = {}): GeneratedResultManagementBackendApi {
  return new GeneratedResultManagementBackendApi({
    listGeneratedResultMetadataUseCase: input.listMetadata ?? new StubListGeneratedResultMetadataUseCase(),
    getGeneratedResultMetadataUseCase: input.getMetadata ?? new StubGetGeneratedResultMetadataUseCase(),
    getGeneratedResultOriginalContentUseCase: input.original ?? new StubGetGeneratedResultOriginalContentUseCase(),
    requestGeneratedResultPreviewContentUseCase: input.previewRequest ?? new StubRequestGeneratedResultPreviewContentUseCase(),
    openGeneratedResultPreviewContentUseCase: input.previewOpen ?? new StubOpenGeneratedResultPreviewContentUseCase(),
    getGeneratedResultLineageSummaryUseCase: input.lineageSummary ?? new StubGetGeneratedResultLineageSummaryUseCase(),
    getGeneratedResultLineageDetailUseCase: input.lineageDetail ?? new StubGetGeneratedResultLineageDetailUseCase(),
  });
}

describe("GeneratedResultManagementBackendApi", () => {
  it("returns invalid-request when actor identity is missing", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    const lineageSummaryUseCase = new StubGetGeneratedResultLineageSummaryUseCase();
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();
    const api = createApi({
      original: useCase,
      previewRequest: previewRequestUseCase,
      previewOpen: previewOpenUseCase,
      lineageSummary: lineageSummaryUseCase,
      lineageDetail: lineageDetailUseCase,
    });

    const response = await api.openGeneratedResultOriginalContentStream({
      actorUserIdentityId: " ",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-request");
  });

  it("maps use-case access-denied to forbidden", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    useCase.mode = "access-denied";
    const lineageSummaryUseCase = new StubGetGeneratedResultLineageSummaryUseCase();
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();

    const api = createApi({
      original: useCase,
      previewRequest: previewRequestUseCase,
      previewOpen: previewOpenUseCase,
      lineageSummary: lineageSummaryUseCase,
      lineageDetail: lineageDetailUseCase,
    });

    const response = await api.openGeneratedResultOriginalContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("forbidden");
  });

  it("maps use-case invalid-state to invalid-state", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    useCase.mode = "invalid-state";
    const lineageSummaryUseCase = new StubGetGeneratedResultLineageSummaryUseCase();
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();

    const api = createApi({
      original: useCase,
      previewRequest: previewRequestUseCase,
      previewOpen: previewOpenUseCase,
      lineageSummary: lineageSummaryUseCase,
      lineageDetail: lineageDetailUseCase,
    });

    const response = await api.openGeneratedResultOriginalContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-state");
  });

  it("returns stream payload for successful protected retrieval", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    const lineageSummaryUseCase = new StubGetGeneratedResultLineageSummaryUseCase();
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();
    const api = createApi({
      original: useCase,
      previewRequest: previewRequestUseCase,
      previewOpen: previewOpenUseCase,
      lineageSummary: lineageSummaryUseCase,
      lineageDetail: lineageDetailUseCase,
    });

    const response = await api.openGeneratedResultOriginalContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.mimeType).toBe("image/png");
    expect(response.data.sizeBytes).toBe(5);
    expect(response.data.contentDisposition).toBe("attachment");

    const chunks: number[] = [];
    for await (const chunk of response.data.stream) {
      chunks.push(...chunk);
    }
    expect(Buffer.from(chunks).toString("utf8")).toBe("hello");
  });

  it("returns preview selection metadata without exposing storage internals", async () => {
    const api = createApi();

    const response = await api.requestGeneratedResultPreview({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.preview.selected?.previewToken).toBe("preview-token-001");
    expect(response.data.preview.selected?.contentEndpoint).toBe("/api/v1/generated-results/gr-asset-001/preview/content");
    expect(JSON.stringify(response.data)).not.toContain("storage-instance://");
  });

  it("maps preview-open invalid state to invalid-state API errors", async () => {
    const openUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    openUseCase.mode = "invalid-state";
    const api = createApi({
      previewOpen: openUseCase,
    });

    const response = await api.openGeneratedResultPreviewContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      previewToken: "preview-token-001",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("invalid-state");
  });

  it("returns lineage summary for authorized callers", async () => {
    const api = createApi();

    const response = await api.getGeneratedResultLineageSummary({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.lineage.resultAssetId).toBe("gr-asset-001");
    expect(response.data.lineage.inputAssetCount).toBe(2);
  });

  it("maps lineage-detail not-found to not-found API error", async () => {
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();
    lineageDetailUseCase.mode = "not-found";
    const api = createApi({
      lineageDetail: lineageDetailUseCase,
    });

    const response = await api.getGeneratedResultLineageDetail({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "missing-result",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });

  it("lists generated result metadata for authorized callers", async () => {
    const api = createApi();
    const response = await api.listGeneratedResults({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      limit: 10,
      offset: 0,
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]?.resultAssetId).toBe("gr-asset-001");
  });

  it("returns generated result detail for get requests", async () => {
    const api = createApi();
    const response = await api.getGeneratedResult({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.result.runId).toBe("run-001");
    expect(response.data.result.preview.state).toBe("preview-available");
  });

  it("maps get result not-found to not-found API errors", async () => {
    const getUseCase = new StubGetGeneratedResultMetadataUseCase();
    getUseCase.mode = "not-found";
    const api = createApi({
      getMetadata: getUseCase,
    });

    const response = await api.getGeneratedResult({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "missing",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });

  it("lists generated results scoped to a run", async () => {
    const api = createApi();
    const response = await api.listGeneratedResultsByRun({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      runId: "run-001",
      limit: 5,
      offset: 0,
    });

    expect(response.ok).toBeTrue();
    if (!response.ok || !response.data) {
      return;
    }
    expect(response.data.runId).toBe("run-001");
    expect(response.data.items[0]?.runId).toBe("run-001");
  });
});
