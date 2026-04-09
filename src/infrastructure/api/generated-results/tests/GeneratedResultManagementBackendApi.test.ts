import { describe, expect, it } from "bun:test";
import {
  GeneratedResultOriginalContentReadErrorCodes,
  type GeneratedResultOriginalContentReadResult,
  type GetGeneratedResultOriginalContentRequest,
  type GetGeneratedResultOriginalContentSuccess,
  type IGetGeneratedResultOriginalContentUseCase,
} from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
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

describe("GeneratedResultManagementBackendApi", () => {
  it("returns invalid-request when actor identity is missing", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const previewRequestUseCase = new StubRequestGeneratedResultPreviewContentUseCase();
    const previewOpenUseCase = new StubOpenGeneratedResultPreviewContentUseCase();
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
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

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
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

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
      requestGeneratedResultPreviewContentUseCase: previewRequestUseCase,
      openGeneratedResultPreviewContentUseCase: previewOpenUseCase,
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
});
