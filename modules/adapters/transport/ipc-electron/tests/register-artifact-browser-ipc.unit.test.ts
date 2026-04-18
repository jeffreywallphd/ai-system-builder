import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopArtifactContentReadRequest,
  createDesktopArtifactMediaViewRequest,
  createDesktopArtifactPublishRequest,
  createDesktopArtifactPublishVerifyRequest,
  createDesktopArtifactReadRequest,
} from "../../../../contracts/ipc";
import {
  mapDesktopArtifactRequestContext,
  mapReadArtifactContentResultToDesktopResponse,
  registerArtifactBrowserIpc,
  type IpcMainHandlePort,
} from "../artifact-browser/registerArtifactBrowserIpc";

function createUseCases() {
  return {
    browseArtifactsUseCase: { execute: testDouble.fn() },
    readArtifactDetailUseCase: { execute: testDouble.fn() },
    readArtifactContentUseCase: { execute: testDouble.fn() },
    artifactMediaViewRetrieval: { retrieveArtifactViewerMediaByStorageKey: testDouble.fn() },
    publishArtifactToRepoUseCase: { execute: testDouble.fn() },
    verifyPublishedArtifactBackingUseCase: { execute: testDouble.fn() },
  };
}

describe("registerArtifactBrowserIpc", () => {
  it("registers browse/read/content channels and delegates to focused use case ports", async () => {
    const handlers = new Map<string, Parameters<IpcMainHandlePort["handle"]>[1]>();
    const ipcMain: IpcMainHandlePort = {
      handle: testDouble.fn((channel, listener) => {
        handlers.set(channel, listener);
      }),
    };

    const dependencies = createUseCases();
    (dependencies.browseArtifactsUseCase.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: { items: [] },
    });
    (dependencies.readArtifactDetailUseCase.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        artifact: {
          locator: { storageKey: "uploads/a.png" },
          artifactKind: "image",
        },
      },
    });
    (dependencies.readArtifactContentUseCase.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        content: {
          locator: { storageKey: "uploads/a.png" },
          availability: "available",
          retrieval: "deferred",
        },
      },
    });

    (dependencies.artifactMediaViewRetrieval.retrieveArtifactViewerMediaByStorageKey as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: { storageKey: "uploads/a.png", mediaType: "image/png", bytes: new Uint8Array([1]) },
    });
    (dependencies.publishArtifactToRepoUseCase.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/a.png",
          revision: "main",
          locator: "openai/demo/images/a.png",
        },
        verification: { exists: true, verifiedAt: "2026-04-17T00:00:00.000Z" },
      },
    });
    (dependencies.verifyPublishedArtifactBackingUseCase.execute as ReturnType<typeof testDouble.fn>).mockResolvedValue({
      ok: true,
      value: {
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/a.png",
          revision: "main",
          locator: "openai/demo/images/a.png",
        },
        verification: { exists: true, verifiedAt: "2026-04-17T00:00:00.000Z" },
      },
    });

    registerArtifactBrowserIpc({ ipcMain, ...dependencies });

    expect(ipcMain.handle).toHaveBeenCalledTimes(6);
    expect(handlers.has(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL.value)).toBe(true);
    expect(handlers.has(DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL.value)).toBe(true);

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
    await handlers.get(DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactMediaViewRequest({
        storageKey: "uploads/a.png",
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );
    await handlers.get(DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactPublishRequest({
        artifactId: "uploads/a.png",
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/a.png",
        },
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );
    await handlers.get(DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL.value)?.(
      {},
      createDesktopArtifactPublishVerifyRequest({
        artifactId: "uploads/a.png",
        boundary: { host: "desktop", source: "desktop.renderer" },
      }),
    );

    expect(dependencies.browseArtifactsUseCase.execute).toHaveBeenCalledWith(
      { artifactKind: "image" },
      { requestId: undefined, correlationId: undefined },
    );
    expect(dependencies.readArtifactDetailUseCase.execute).toHaveBeenCalledWith(
      { locator: { storageKey: "uploads/a.png" } },
      { requestId: undefined, correlationId: undefined },
    );
    expect(dependencies.readArtifactContentUseCase.execute).toHaveBeenCalledWith(
      { locator: { storageKey: "uploads/a.png" } },
      { requestId: undefined, correlationId: undefined },
    );
    expect(dependencies.artifactMediaViewRetrieval.retrieveArtifactViewerMediaByStorageKey).toHaveBeenCalledWith(
      { storageKey: "uploads/a.png" },
      { requestId: undefined, correlationId: undefined },
    );
    expect(dependencies.publishArtifactToRepoUseCase.execute).toHaveBeenCalledWith({
      artifactId: "uploads/a.png",
      target: {
        provider: "huggingface",
        repository: "openai/demo",
        path: "images/a.png",
        revision: undefined,
      },
      mediaType: undefined,
    });
    expect(dependencies.verifyPublishedArtifactBackingUseCase.execute).toHaveBeenCalledWith({
      artifactId: "uploads/a.png",
    });
  });

  it("maps descriptor-oriented content failures through explicit response helper", () => {
    const request = createDesktopArtifactContentReadRequest({
      locator: { storageKey: "uploads/missing.png" },
      boundary: { host: "desktop", source: "desktop.renderer" },
    });

    const response = mapReadArtifactContentResultToDesktopResponse(
      {
        ok: false,
        error: {
          code: "not-found",
          message: "not found",
          details: { storageKey: "uploads/missing.png" },
        },
      },
      request,
    );

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: "not-found",
      },
      requestId: request.requestId,
      correlationId: request.correlationId,
    });
  });

  it("maps request correlation metadata with an explicit helper", () => {
    const request = createDesktopArtifactBrowseRequest({
      artifactKind: "image",
      boundary: { host: "desktop", source: "desktop.renderer" },
    }, {
      requestId: "req-ipc-1",
      correlationId: "corr-ipc-1",
    });

    expect(mapDesktopArtifactRequestContext(request)).toEqual({
      requestId: "req-ipc-1",
      correlationId: "corr-ipc-1",
    });
  });
});
