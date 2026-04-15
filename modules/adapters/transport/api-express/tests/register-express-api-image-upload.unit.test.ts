import { describe, expect, it, vi } from "vitest";

import { createContractError } from "../../../../contracts/shared";
import {
  mapApiImageUploadRequestToCommand,
  mapStoreImageUploadResultToApiResponse,
  registerExpressApi,
  type ExpressPostRoutePort,
  type StoreImageUploadUseCasePort,
} from "../registerExpressApi";

function createUseCaseStub(
  executeImpl?: ReturnType<typeof vi.fn<StoreImageUploadUseCasePort["execute"]>>,
): StoreImageUploadUseCasePort {
  return {
    execute:
      executeImpl
      ?? vi
        .fn<StoreImageUploadUseCasePort["execute"]>()
        .mockRejectedValue(new Error("Missing execute mock implementation.")),
  };
}

describe("registerExpressApi image upload mappings", () => {
  it("maps api request payload into the store image upload command", () => {
    const command = mapApiImageUploadRequestToCommand({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: [137, 80, 78, 71],
      source: "web.upload.form",
    });

    expect(command).toEqual({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71]),
    });
  });

  it("maps store-image-upload use-case success into an api success envelope", () => {
    const response = mapStoreImageUploadResultToApiResponse(
      {
        ok: true,
        value: {
          descriptor: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
        },
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );

    expect(response).toEqual({
      ok: true,
      operation: "image.upload",
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
      metadata: undefined,
    });
  });

  it("maps store-image-upload use-case failure into an api failure envelope", () => {
    const response = mapStoreImageUploadResultToApiResponse(
      {
        ok: false,
        error: createContractError("validation", "mediaType must be an image media type.", {
          details: {
            field: "mediaType",
          },
        }),
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
      },
      {
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
      },
    );

    expect(response).toEqual({
      ok: false,
      operation: "image.upload",
      error: {
        operation: "image.upload",
        code: "validation",
        message: "mediaType must be an image media type.",
        details: {
          field: "mediaType",
        },
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
        metadata: undefined,
        kind: "client",
      },
      requestId: "req-upload-2",
      correlationId: "corr-upload-2",
      metadata: undefined,
    });
  });

  it("registers a thin upload route that maps request body and headers to the use case", async () => {
    let registeredPath: string | undefined;
    let registeredHandler:
      | ((
        request: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[0],
        response: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[1],
      ) => Promise<void>)
      | undefined;

    const app: ExpressPostRoutePort = {
      post: vi.fn((path, handler) => {
        registeredPath = path;
        registeredHandler = handler;
      }),
    };

    const execute = vi.fn<StoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-3",
      correlationId: "corr-upload-3",
    });

    registerExpressApi({
      app,
      storeImageUploadUseCase: createUseCaseStub(execute),
    });

    expect(app.post).toHaveBeenCalledOnce();
    expect(registeredPath).toBe("/api/image/upload");
    expect(registeredHandler).toBeTypeOf("function");

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await registeredHandler?.(
      {
        body: {
          fileName: "cat.png",
          mediaType: "image/png",
          bytes: [137, 80, 78, 71],
          source: "server.web.upload-form",
        },
        headers: {
          "x-request-id": "req-upload-3",
          "x-correlation-id": "corr-upload-3",
        },
      },
      {
        status,
        json,
      },
    );

    expect(execute).toHaveBeenCalledWith(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        host: "server",
        source: "server.web.upload-form",
      },
      {
        requestId: "req-upload-3",
        correlationId: "corr-upload-3",
      },
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      ok: true,
      operation: "image.upload",
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-3",
      correlationId: "corr-upload-3",
      metadata: undefined,
    });
  });
});
