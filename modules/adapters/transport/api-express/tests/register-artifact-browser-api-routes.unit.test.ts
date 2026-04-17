import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import {
  registerArtifactBrowserApiRoutes,
  type ArtifactBrowserUseCasePort,
  type ExpressPostRoutePort,
} from "../artifact-browser/registerArtifactBrowserApiRoutes";

function createUseCases(): ArtifactBrowserUseCasePort {
  return {
    browseArtifacts: { execute: testDouble.fn() },
    readArtifactDetail: { execute: testDouble.fn() },
    readArtifactContent: { execute: testDouble.fn() },
  } as ArtifactBrowserUseCasePort;
}

describe("registerArtifactBrowserApiRoutes", () => {
  it("registers browse/detail/content routes and delegates to use cases", async () => {
    const handlers = new Map<string, Parameters<ExpressPostRoutePort["post"]>[1]>();
    const app: ExpressPostRoutePort = {
      post: testDouble.fn((path, handler) => {
        handlers.set(path, handler);
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

    registerArtifactBrowserApiRoutes({ app, useCases });

    expect(app.post).toHaveBeenCalledTimes(3);
    expect(handlers.has("/api/artifact/browse")).toBe(true);
    expect(handlers.has("/api/artifact/read")).toBe(true);
    expect(handlers.has("/api/artifact/content/read")).toBe(true);

    const response = {
      status: testDouble.fn(() => response),
      json: testDouble.fn(),
    };

    await handlers.get("/api/artifact/browse")?.(
      { body: { artifactKind: "image", source: "thin-client" }, headers: {} },
      response,
    );
    await handlers.get("/api/artifact/read")?.(
      { body: { locator: { storageKey: "uploads/a.png" }, source: "thin-client" }, headers: {} },
      response,
    );
    await handlers.get("/api/artifact/content/read")?.(
      { body: { locator: { storageKey: "uploads/a.png" }, source: "thin-client" }, headers: {} },
      response,
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
