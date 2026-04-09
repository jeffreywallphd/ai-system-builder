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

describe("GeneratedResultManagementBackendApi", () => {
  it("returns invalid-request when actor identity is missing", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    const lineageSummaryUseCase = new StubGetGeneratedResultLineageSummaryUseCase();
    const lineageDetailUseCase = new StubGetGeneratedResultLineageDetailUseCase();
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
      getGeneratedResultLineageSummaryUseCase: lineageSummaryUseCase,
      getGeneratedResultLineageDetailUseCase: lineageDetailUseCase,
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

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
      getGeneratedResultLineageSummaryUseCase: lineageSummaryUseCase,
      getGeneratedResultLineageDetailUseCase: lineageDetailUseCase,
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

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
      getGeneratedResultLineageSummaryUseCase: lineageSummaryUseCase,
      getGeneratedResultLineageDetailUseCase: lineageDetailUseCase,
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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
      getGeneratedResultLineageSummaryUseCase: lineageSummaryUseCase,
      getGeneratedResultLineageDetailUseCase: lineageDetailUseCase,
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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: new StubGetGeneratedResultOriginalContentUseCase(),
      requestGeneratedResultPreviewContentUseCase: new StubRequestGeneratedResultPreviewContentUseCase(),
      openGeneratedResultPreviewContentUseCase: new StubOpenGeneratedResultPreviewContentUseCase(),
      getGeneratedResultLineageSummaryUseCase: new StubGetGeneratedResultLineageSummaryUseCase(),
      getGeneratedResultLineageDetailUseCase: new StubGetGeneratedResultLineageDetailUseCase(),
    });

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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: new StubGetGeneratedResultOriginalContentUseCase(),
      requestGeneratedResultPreviewContentUseCase: new StubRequestGeneratedResultPreviewContentUseCase(),
      openGeneratedResultPreviewContentUseCase: openUseCase,
      getGeneratedResultLineageSummaryUseCase: new StubGetGeneratedResultLineageSummaryUseCase(),
      getGeneratedResultLineageDetailUseCase: new StubGetGeneratedResultLineageDetailUseCase(),
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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: new StubGetGeneratedResultOriginalContentUseCase(),
      requestGeneratedResultPreviewContentUseCase: new StubRequestGeneratedResultPreviewContentUseCase(),
      openGeneratedResultPreviewContentUseCase: new StubOpenGeneratedResultPreviewContentUseCase(),
      getGeneratedResultLineageSummaryUseCase: new StubGetGeneratedResultLineageSummaryUseCase(),
      getGeneratedResultLineageDetailUseCase: new StubGetGeneratedResultLineageDetailUseCase(),
    });

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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: new StubGetGeneratedResultOriginalContentUseCase(),
      requestGeneratedResultPreviewContentUseCase: new StubRequestGeneratedResultPreviewContentUseCase(),
      openGeneratedResultPreviewContentUseCase: new StubOpenGeneratedResultPreviewContentUseCase(),
      getGeneratedResultLineageSummaryUseCase: new StubGetGeneratedResultLineageSummaryUseCase(),
      getGeneratedResultLineageDetailUseCase: lineageDetailUseCase,
    });

    const response = await api.getGeneratedResultLineageDetail({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "missing-result",
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.code).toBe("not-found");
  });
});
