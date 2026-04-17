import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  mapArtifactBrowseApiRequestToCommand,
  mapReadArtifactContentResultToApiResponse,
  registerArtifactBrowserApiRoutes,
  type ExpressRoutePort,
} from "../artifact-browser/registerArtifactBrowserApiRoutes";

function createUseCases() {
  return {
    browseArtifactsUseCase: { execute: testDouble.fn() },
    readArtifactDetailUseCase: { execute: testDouble.fn() },
    readArtifactContentUseCase: { execute: testDouble.fn() },
    artifactContentRetrieval: { retrieveArtifactContentByStorageKey: testDouble.fn() },
  };
}

describe("registerArtifactBrowserApiRoutes", () => {
  it("registers browse/detail/content routes and delegates to focused use case ports", async () => {
    const postHandlers = new Map<string, Parameters<ExpressRoutePort["post"]>[1]>();
    const getHandlers = new Map<string, Parameters<ExpressRoutePort["get"]>[1]>();
    const app: ExpressRoutePort = {
      post: testDouble.fn((routePath, handler) => {
        postHandlers.set(routePath, handler);
      }),
      get: testDouble.fn((routePath, handler) => {
        getHandlers.set(routePath, handler);
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
    (dependencies.artifactContentRetrieval.retrieveArtifactContentByStorageKey as ReturnType<typeof testDouble.fn>)
      .mockResolvedValue({ ok: true, value: { storageKey: "uploads/a.png", mediaType: "image/png", bytes: new Uint8Array([1]) } });

    registerArtifactBrowserApiRoutes({ app, ...dependencies });

    expect(app.post).toHaveBeenCalledTimes(3);
    expect(app.get).toHaveBeenCalledTimes(1);
    expect(postHandlers.has("/api/artifact/browse")).toBe(true);
    expect(postHandlers.has("/api/artifact/read")).toBe(true);
    expect(postHandlers.has("/api/artifact/content/read")).toBe(true);
    expect(getHandlers.has("/api/artifact/content/view")).toBe(true);

    const response = {
      status: testDouble.fn(() => response),
      json: testDouble.fn(),
      send: testDouble.fn(),
      setHeader: testDouble.fn(),
    };

    await postHandlers.get("/api/artifact/browse")?.(
      { body: { artifactKind: "image", source: "thin-client" }, headers: {} },
      response,
    );
    await postHandlers.get("/api/artifact/read")?.(
      { body: { locator: { storageKey: "uploads/a.png" }, source: "thin-client" }, headers: {} },
      response,
    );
    await postHandlers.get("/api/artifact/content/read")?.(
      { body: { locator: { storageKey: "uploads/a.png" }, source: "thin-client" }, headers: {} },
      response,
    );
    await getHandlers.get("/api/artifact/content/view")?.(
      { query: { storageKey: "uploads/a.png" }, headers: {} },
      response,
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
    expect(dependencies.artifactContentRetrieval.retrieveArtifactContentByStorageKey).toHaveBeenCalledWith(
      { storageKey: "uploads/a.png" },
      { requestId: undefined, correlationId: undefined },
    );
    expect(response.send).toHaveBeenCalled();
  });

  it("maps api request payload and use case failure responses through explicit helpers", () => {
    expect(
      mapArtifactBrowseApiRequestToCommand(
        { artifactKind: "image", source: " thin-client.browser " },
        { requestId: "req-1", correlationId: "corr-1" },
      ),
    ).toEqual({ artifactKind: "image" });

    const mapped = mapReadArtifactContentResultToApiResponse(
      {
        ok: false,
        error: {
          code: "not-found",
          message: "missing",
          details: { key: "uploads/missing.png" },
        },
      },
      { requestId: "req-2", correlationId: "corr-2" },
    );

    expect(mapped).toMatchObject({
      ok: false,
      error: {
        code: "not-found",
      },
      requestId: "req-2",
      correlationId: "corr-2",
    });
  });
});
