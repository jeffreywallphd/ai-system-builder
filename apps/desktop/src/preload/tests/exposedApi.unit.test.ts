import { describe, expect, it, testDouble } from "../../../../../modules/testing/node-test";

import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  createDesktopArtifactBrowseSuccessResponse,
  createDesktopArtifactMediaViewSuccessResponse,
  createDesktopImageUploadSuccessResponse,
  createIpcChannel,
  createIpcError,
  createIpcFailureResponse,
} from "../../../../../modules/contracts/ipc";
import { createDesktopPreloadApi, type IpcRendererInvokePort } from "../exposedApi";

describe("desktop preload exposedApi bridge", () => {
  it("maps bridge input into desktop upload request envelope and invokes request channel", async () => {
    const invoke = testDouble.fn<IpcRendererInvokePort["invoke"]>().mockResolvedValue(
      createDesktopImageUploadSuccessResponse(
        {
          sourceKind: "upload",
          storage: {
            key: "uploads/kitten.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
        },
        {
          requestId: "req-upload-1",
          correlationId: "corr-upload-1",
        },
      ),
    );
    const api = createDesktopPreloadApi({ ipcRenderer: { invoke } });

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
    const [channel, request] = invoke.mock.calls[0] as [string, { operation: string; payload: { boundary: { host: string; source: string } } }];
    expect(channel).toBe(DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value);
    expect(request.operation).toBe("image.upload");
    expect(request.payload.boundary).toEqual({ host: "desktop", source: "desktop.renderer.upload-form" });
  });

  it("maps artifact browse and media-view operations to separate request channels", async () => {
    const responses = [
      createDesktopArtifactBrowseSuccessResponse({ items: [] }),
      createDesktopArtifactMediaViewSuccessResponse({
        storageKey: "uploads/cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1, 2]),
      }),
    ];
    let index = 0;
    const invoke = testDouble.fn<IpcRendererInvokePort["invoke"]>().mockImplementation(async () => {
      const response = responses[index];
      index += 1;
      return response;
    });
    const api = createDesktopPreloadApi({ ipcRenderer: { invoke } });

    await api.browseArtifacts();
    const mediaResponse = await api.readArtifactViewerMedia({ storageKey: "uploads/cat.png" });

    expect(invoke.mock.calls[0]?.[0]).toBe(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value);
    expect(invoke.mock.calls[1]?.[0]).toBe(DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value);
    expect(mediaResponse.ok).toBe(true);
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
    const api = createDesktopPreloadApi({ ipcRenderer: { invoke } });

    await expect(
      api.uploadImage({
        fileName: "cat.png",
        mediaType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow("Received invalid desktop image upload IPC response envelope.");
  });
});
