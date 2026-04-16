import { describe, expect, expectTypeOf, it, vi } from "../../../../testing/node-test";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { StructuredLogEvent } from "../../../../contracts/logging";

import { composeServerHost } from "../composeServerHost";

describe("composeServerHost", () => {
  it("provides a LoggingPort-backed seam using the real logging adapter", async () => {
    const sink = vi.fn();
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

  it("registers server image upload routes using a provided app port without creating express", () => {
    const app = {
      post: vi.fn(),
    };

    const host = composeServerHost();

    host.registerApi({
      app,
      storageRootDirectory: "/tmp/server-image-upload-test",
    });

    expect(app.post).toHaveBeenCalledOnce();
    expect(app.post).toHaveBeenCalledWith(
      "/api/image/upload",
      expect.any(Function),
    );
  });
});
