import { describe, expect, expectTypeOf, it, testDouble } from "../../../../testing/node-test";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { StructuredLogEvent } from "../../../../contracts/logging";

import { composeServerHost } from "../composeServerHost";

describe("composeServerHost", () => {
  it("provides a LoggingPort-backed seam using the real logging adapter", async () => {
    const sink = testDouble.fn();
    const host = composeServerHost({
      logging: {
        verbosity: "verbose",
        level: "debug",
      },
      logSink: sink,
    });

    expectTypeOf(host.loggingPort).toExtend<LoggingPort>();
    expect(host.loggingConfig).toEqual({
      verbosity: "verbose",
      level: "debug",
      includeDiagnostics: undefined,
    });

    const event: StructuredLogEvent = {
      timestamp: "2026-04-14T12:00:00.000Z",
      level: "info",
      verbosity: "normal",
      event: "upload.started",
      message: "Upload started",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
    };

    await host.loggingPort.log(event);

    expect(sink).toHaveBeenCalledOnce();
    const [, emittedEvent] = sink.mock.calls[0] as [string, StructuredLogEvent];
    expect(emittedEvent).toMatchObject({
      event: "upload.started",
      host: "server",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
    });
  });



  it("composes artifact-repo storage with huggingface provider registration", async () => {
    const fetchMock = testDouble.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;

    const host = composeServerHost({
      artifactRepo: {
        huggingFaceFetchImplementation: fetchMock,
      },
    });

    const result = await host.artifactRepoStorage.hasArtifactInRepo({
      target: {
        provider: "huggingface",
        repository: "openai/demo-artifacts",
        path: "images/a.png",
      },
    });

    expect(host.artifactRepoStorage).toBeDefined();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected hasArtifactInRepo success result.");
    }
    expect(result.value.exists).toBe(false);
  });

  it("registers server image upload routes using a provided app port without creating express", () => {
    const app = {
      post: testDouble.fn(),
      get: testDouble.fn(),
    };

    const host = composeServerHost();

    host.registerApi({
      app,
      storageRootDirectory: "/tmp/server-image-upload-test",
    });

    expect(app.post).toHaveBeenCalledTimes(7);
    expect(app.get).toHaveBeenCalledTimes(1);
    const registeredPaths = app.post.mock.calls.map((call) => call[0]);
    expect(registeredPaths).toEqual([
      "/api/image/upload",
      "/api/artifact/browse",
      "/api/artifact/read",
      "/api/artifact/content/read",
      "/api/artifact-repo/has",
      "/api/artifact-repo/store",
      "/api/artifact/publish",
    ]);
    const registeredGetPaths = app.get.mock.calls.map((call) => call[0]);
    expect(registeredGetPaths).toEqual(["/api/artifact/media/view"]);
  });
});
