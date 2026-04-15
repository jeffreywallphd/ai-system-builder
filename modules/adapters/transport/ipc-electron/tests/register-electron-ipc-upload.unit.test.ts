import { describe, expect, it, vi } from "vitest";

import {
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  createDesktopImageUploadRequest,
} from "../../../../contracts/ipc";
import { createContractError } from "../../../../contracts/shared";
import {
  createDesktopImageUploadIpcHandler,
  registerElectronIpc,
  type IpcMainHandlePort,
  type StoreImageUploadUseCasePort,
} from "../registerElectronIpc";

function createUseCaseStub(
  executeImpl?: ReturnType<typeof vi.fn<StoreImageUploadUseCasePort["execute"]>>,
): StoreImageUploadUseCasePort {
  return {
    execute:
      executeImpl ??
      vi
        .fn<StoreImageUploadUseCasePort["execute"]>()
        .mockRejectedValue(new Error("Missing execute mock implementation.")),
  };
}

describe("registerElectronIpc desktop image upload handler", () => {
  it("maps request payload and context into the upload use case and returns a success response", async () => {
    const execute = vi.fn<StoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/kitten.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
    });

    const handler = createDesktopImageUploadIpcHandler(createUseCaseStub(execute));
    const request = createDesktopImageUploadRequest(
      {
        fileName: "kitten.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );

    const response = await handler({}, request);

    expect(execute).toHaveBeenCalledWith(
      {
        fileName: "kitten.png",
        mediaType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        host: "desktop",
        source: "desktop.renderer.upload-form",
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );
    expect(response).toEqual({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/kitten.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
      requestId: "req-upload-1",
      correlationId: "corr-upload-1",
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      metadata: undefined,
    });
  });

  it("maps use-case failures to a structured ipc failure response envelope", async () => {
    const execute = vi.fn<StoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
      ok: false,
      error: createContractError("validation", "mediaType must be an image media type.", {
        details: {
          field: "mediaType",
        },
      }),
      requestId: "req-upload-2",
      correlationId: "corr-upload-2",
    });

    const handler = createDesktopImageUploadIpcHandler(createUseCaseStub(execute));
    const request = createDesktopImageUploadRequest(
      {
        fileName: "brochure.pdf",
        mediaType: "application/pdf",
        bytes: new Uint8Array([1, 2, 3]),
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      },
      {
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
      },
    );

    const response = await handler({}, request);

    expect(response).toEqual({
      ok: false,
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
        details: {
          field: "mediaType",
        },
        requestId: "req-upload-2",
        correlationId: "corr-upload-2",
        metadata: undefined,
        operation: "image.upload",
        channel: "ipc.image.upload.response",
      },
      requestId: "req-upload-2",
      correlationId: "corr-upload-2",
      metadata: undefined,
    });
  });

  it("registers only the upload request channel and delegates handler execution", async () => {
    let registeredHandler:
      | ((event: unknown, request: ReturnType<typeof createDesktopImageUploadRequest>) => Promise<unknown>)
      | undefined;
    const ipcMain: IpcMainHandlePort = {
      handle: vi.fn((channel: string, listener: Parameters<IpcMainHandlePort["handle"]>[1]) => {
        expect(channel).toBe(DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value);
        registeredHandler = listener;
      }),
    };
    const execute = vi.fn<StoreImageUploadUseCasePort["execute"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 16,
        },
      },
      requestId: "req-upload-3",
    });

    registerElectronIpc({
      ipcMain,
      storeImageUploadUseCase: createUseCaseStub(execute),
    });

    expect(ipcMain.handle).toHaveBeenCalledTimes(1);
    expect(registeredHandler).toBeDefined();
    const request = createDesktopImageUploadRequest(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3, 4]),
        boundary: {
          host: "desktop",
          source: "desktop.renderer.upload-form",
        },
      },
      {
        requestId: "req-upload-3",
      },
    );

    const response = await registeredHandler?.({}, request);

    expect(response).toMatchObject({
      ok: true,
      channel: "ipc.image.upload.response",
      operation: "image.upload",
    });
    expect(execute).toHaveBeenCalledWith(
      {
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2, 3, 4]),
      },
      {
        host: "desktop",
        source: "desktop.renderer.upload-form",
      },
      {
        requestId: "req-upload-3",
        correlationId: undefined,
      },
    );
  });
});
