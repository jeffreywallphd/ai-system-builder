import { describe, expect, it, testDouble } from "../../../../../modules/testing/node-test";

import {
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  createIpcChannel,
  createDesktopImageUploadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
} from "../../../../../modules/contracts/ipc";
import { createDesktopPreloadApi, type IpcRendererInvokePort } from "../exposedApi";

describe("desktop preload exposedApi uploadImage bridge", () => {
  it("maps bridge input into the desktop upload request envelope and invokes the request channel", async () => {
    const invoke = testDouble.fn<IpcRendererInvokePort["invoke"]>().mockResolvedValue(
      createDesktopImageUploadSuccessResponse(
        {
          key: "uploads/kitten.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
        {
          requestId: "req-upload-1",
          correlationId: "corr-upload-1",
        },
      ),
    );
    const api = createDesktopPreloadApi({
      ipcRenderer: {
        invoke,
      },
    });

    const response = await api.uploadImage(
      {
        fileName: " kitten.png ",
        mediaType: " image/png ",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
      {
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
      },
    );

    expect(response.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value,
      {
        channel: "ipc.image.upload.request",
        operation: "image.upload",
        payload: {
          fileName: "kitten.png",
          mediaType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71]),
          boundary: {
            host: "desktop",
            source: "desktop.renderer.upload-form",
          },
        },
        requestId: "req-upload-1",
        correlationId: "corr-upload-1",
        metadata: undefined,
      },
    );
  });

  it("supports preload-owned boundary source overrides without exposing IPC internals to ui callers", async () => {
    const invoke = testDouble.fn<IpcRendererInvokePort["invoke"]>().mockResolvedValue(
      createDesktopImageUploadSuccessResponse({
        key: "uploads/cat.png",
        mediaType: "image/png",
        sizeBytes: 8,
      }),
    );
    const api = createDesktopPreloadApi({
      ipcRenderer: {
        invoke,
      },
      uploadSource: "desktop.renderer.drag-drop",
    });

    await api.uploadImage({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    const request = invoke.mock.calls[0]?.[1];
    expect(request?.payload.boundary).toEqual({
      host: "desktop",
      source: "desktop.renderer.drag-drop",
    });
  });

  it("throws when IPC returns a response envelope for the wrong operation or channel", async () => {
    const invoke = testDouble.fn<IpcRendererInvokePort["invoke"]>().mockResolvedValue(
      createIpcFailureResponse(
        createIpcError(
          createIpcChannel("image.archive", "response"),
          "internal",
          "wrong channel",
        ),
      ),
    );
    const api = createDesktopPreloadApi({
      ipcRenderer: {
        invoke,
      },
    });

    await expect(
      api.uploadImage({
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("Received invalid desktop image upload IPC response envelope.");
  });
});
