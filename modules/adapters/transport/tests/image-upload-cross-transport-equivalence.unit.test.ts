import { describe, expect, it, vi } from "../../../testing/node-test";

import { createDesktopImageUploadRequest } from "../../../contracts/ipc";
import { createContractError } from "../../../contracts/shared";
import {
  createDesktopImageUploadIpcHandler,
  type StoreImageUploadUseCasePort as IpcStoreImageUploadUseCasePort,
} from "../ipc-electron/image-upload/registerImageUploadIpc";
import {
  registerImageUploadApiRoute,
  type ExpressPostRoutePort,
  type StoreImageUploadUseCasePort as ApiStoreImageUploadUseCasePort,
} from "../api-express/image-upload/registerImageUploadApiRoute";

function createIpcUseCaseStub(
  executeImpl?: ReturnType<typeof vi.fn<IpcStoreImageUploadUseCasePort["execute"]>>,
): IpcStoreImageUploadUseCasePort {
  return {
    execute:
      executeImpl
      ?? vi
        .fn<IpcStoreImageUploadUseCasePort["execute"]>()
        .mockRejectedValue(new Error("Missing execute mock implementation.")),
  };
}

function createApiUseCaseStub(
  executeImpl?: ReturnType<typeof vi.fn<ApiStoreImageUploadUseCasePort["execute"]>>,
): ApiStoreImageUploadUseCasePort {
  return {
    execute:
      executeImpl
      ?? vi
        .fn<ApiStoreImageUploadUseCasePort["execute"]>()
        .mockRejectedValue(new Error("Missing execute mock implementation.")),
  };
}

async function invokeApiUploadRoute(
  execute: ReturnType<typeof vi.fn<ApiStoreImageUploadUseCasePort["execute"]>>,
) {
  let registeredHandler:
    | ((
      request: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[0],
      response: Parameters<Parameters<ExpressPostRoutePort["post"]>[1]>[1],
    ) => Promise<void>)
    | undefined;
  const app: ExpressPostRoutePort = {
    post: vi.fn((_, handler) => {
      registeredHandler = handler;
    }),
  };

  registerImageUploadApiRoute({
    app,
    storeImageUploadUseCase: createApiUseCaseStub(execute),
  });

  const status = vi.fn().mockReturnThis();
  const json = vi.fn();

  await registeredHandler?.(
    {
      body: {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: [137, 80, 78, 71],
        source: "shared.upload.form",
      },
      headers: {
        "x-request-id": "req-transport-1",
        "x-correlation-id": "corr-transport-1",
      },
    },
    {
      status,
      json,
    },
  );

  return {
    status,
    json,
  };
}

describe("image upload cross-transport equivalence", () => {
  it("maps equivalent IPC and API upload input into the same application command shape", async () => {
    const executeFromIpc = vi
      .fn<IpcStoreImageUploadUseCasePort["execute"]>()
      .mockResolvedValue({
        ok: true,
        value: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
      });
    const ipcHandler = createDesktopImageUploadIpcHandler(createIpcUseCaseStub(executeFromIpc));

    await ipcHandler(
      {},
      createDesktopImageUploadRequest(
        {
          fileName: "cat.png",
          mediaType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71]),
          boundary: {
            host: "desktop",
            source: "shared.upload.form",
          },
        },
        {
          requestId: "req-transport-1",
          correlationId: "corr-transport-1",
        },
      ),
    );

    const executeFromApi = vi
      .fn<ApiStoreImageUploadUseCasePort["execute"]>()
      .mockResolvedValue({
        ok: true,
        value: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
      });
    await invokeApiUploadRoute(executeFromApi);

    expect(executeFromIpc).toHaveBeenCalledWith(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        source: "shared.upload.form",
      },
      {
        requestId: "req-transport-1",
        correlationId: "corr-transport-1",
      },
    );
    expect(executeFromApi).toHaveBeenCalledWith(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        source: "shared.upload.form",
      },
      {
        requestId: "req-transport-1",
        correlationId: "corr-transport-1",
      },
    );
  });

  it("preserves equivalent success and failure semantics across IPC and API response envelopes", async () => {
    const ipcSuccess = await createDesktopImageUploadIpcHandler(
      createIpcUseCaseStub(
        vi.fn<IpcStoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
          ok: true,
          value: {
            storage: {
              key: "uploads/cat.png",
              mediaType: "image/png",
              sizeBytes: 4,
            },
            sourceKind: "upload",
          },
          requestId: "req-transport-2",
          correlationId: "corr-transport-2",
        }),
      ),
    )(
      {},
      createDesktopImageUploadRequest(
        {
          fileName: "cat.png",
          mediaType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71]),
          boundary: {
            host: "desktop",
            source: "shared.upload.form",
          },
        },
        {
          requestId: "req-transport-2",
          correlationId: "corr-transport-2",
        },
      ),
    );

    const apiSuccessCall = await invokeApiUploadRoute(
      vi.fn<ApiStoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
        ok: true,
        value: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
          sourceKind: "upload",
        },
        requestId: "req-transport-2",
        correlationId: "corr-transport-2",
      }),
    );

    expect(ipcSuccess.ok).toBe(true);
    expect(apiSuccessCall.status).toHaveBeenCalledWith(200);
    expect(apiSuccessCall.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        operation: "image.upload",
        requestId: "req-transport-2",
        correlationId: "corr-transport-2",
        value: {
          descriptor: {
            storage: {
              key: "uploads/cat.png",
              mediaType: "image/png",
              sizeBytes: 4,
            },
            sourceKind: "upload",
          },
        },
      }),
    );

    const ipcFailure = await createDesktopImageUploadIpcHandler(
      createIpcUseCaseStub(
        vi.fn<IpcStoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
          ok: false,
          error: createContractError("validation", "mediaType must be an image media type."),
          requestId: "req-transport-3",
          correlationId: "corr-transport-3",
        }),
      ),
    )(
      {},
      createDesktopImageUploadRequest(
        {
          fileName: "cat.png",
          mediaType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71]),
          boundary: {
            host: "desktop",
            source: "shared.upload.form",
          },
        },
        {
          requestId: "req-transport-3",
          correlationId: "corr-transport-3",
        },
      ),
    );

    const apiFailureCall = await invokeApiUploadRoute(
      vi.fn<ApiStoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
        ok: false,
        error: createContractError("validation", "mediaType must be an image media type."),
        requestId: "req-transport-3",
        correlationId: "corr-transport-3",
      }),
    );

    expect(ipcFailure).toMatchObject({
      ok: false,
      operation: "image.upload",
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });
    expect(apiFailureCall.status).toHaveBeenCalledWith(400);
    expect(apiFailureCall.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        operation: "image.upload",
        error: {
          code: "validation",
          message: "mediaType must be an image media type.",
        },
      }),
    );
  });
});
