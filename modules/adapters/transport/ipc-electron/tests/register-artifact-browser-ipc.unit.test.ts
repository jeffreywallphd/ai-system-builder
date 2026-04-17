import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopArtifactContentReadRequest,
  createDesktopArtifactReadRequest,
} from "../../../../contracts/ipc";
import {
  registerArtifactBrowserIpc,
  type ArtifactBrowserUseCasePort,
  type IpcMainHandlePort,
} from "../artifact-browser/registerArtifactBrowserIpc";

function createUseCases(): ArtifactBrowserUseCasePort {
  return {
    browseArtifacts: { execute: testDouble.fn() },
    readArtifactDetail: { execute: testDouble.fn() },
    readArtifactContent: { execute: testDouble.fn() },
  } as ArtifactBrowserUseCasePort;
}

describe("registerArtifactBrowserIpc", () => {
  it("registers browse/read/content channels and delegates to use cases", async () => {
    const handlers = new Map<string, Parameters<IpcMainHandlePort["handle"]>[1]>();
    const ipcMain: IpcMainHandlePort = {
      handle: testDouble.fn((channel, listener) => {
        handlers.set(channel, listener);
      }),
    };

    const useCases = createUseCases();
    (useCases.browseArtifacts.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: { items: [] },
    });
    (useCases.readArtifactDetail.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        artifact: {
          locator: { storageKey: "uploads/a.png" },
          artifactKind: "image",
        },
      },
    });
    (useCases.readArtifactContent.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        content: {
          locator: { storageKey: "uploads/a.png" },
          availability: "available",
          retrieval: "deferred",
        },
      },
    });

    registerArtifactBrowserIpc({ ipcMain, useCases });

    expect(ipcMain.handle).toHaveBeenCalledTimes(3);
    expect(handlers.has(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value)).toBe(true);

    await handlers.get(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactBrowseRequest({
        artifactKind: "image",
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );
    await handlers.get(DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactReadRequest({
        locator: { storageKey: "uploads/a.png" },
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );
    await handlers.get(DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactContentReadRequest({
        locator: { storageKey: "uploads/a.png" },
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );

    expect(useCases.browseArtifacts.execute).toHaveBeenCalledWith(
      { artifactKind: "image" },
      { requestId: undefined, correlationId: undefined },
    );
    expect(useCases.readArtifactDetail.execute).toHaveBeenCalledWith(
      { locator: { storageKey: "uploads/a.png" } },
      { requestId: undefined, correlationId: undefined },
    );
    expect(useCases.readArtifactContent.execute).toHaveBeenCalledWith(
      { locator: { storageKey: "uploads/a.png" } },
      { requestId: undefined, correlationId: undefined },
    );
  });
});
