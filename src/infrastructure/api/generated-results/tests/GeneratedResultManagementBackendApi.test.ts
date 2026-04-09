import { describe, expect, it } from "bun:test";
import {
  GeneratedResultOriginalContentReadErrorCodes,
  type GeneratedResultOriginalContentReadResult,
  type GetGeneratedResultOriginalContentRequest,
  type GetGeneratedResultOriginalContentSuccess,
  type IGetGeneratedResultOriginalContentUseCase,
} from "@application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
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

describe("GeneratedResultManagementBackendApi", () => {
  it("returns invalid-request when actor identity is missing", async () => {
    const useCase = new StubGetGeneratedResultOriginalContentUseCase();
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
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
    useCase.mode = "access-denied";

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
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
    useCase.mode = "invalid-state";

    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
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
    const api = new GeneratedResultManagementBackendApi({
      getGeneratedResultOriginalContentUseCase: useCase,
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
});
