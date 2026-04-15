import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { LoggingPort } from "../../../../application/ports/logging";
import type { StructuredLogEvent } from "../../../../contracts/logging";

import { composeDesktopHost } from "../composeDesktopHost";

describe("composeDesktopHost", () => {
  it("provides a LoggingPort-backed seam using the real logging adapter", async () => {
    const sink = vi.fn();
    const host = composeDesktopHost({
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
      host: "desktop",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
    });
  });

  it("keeps the composition seam usable for upload success and failure event logging", async () => {
    const sink = vi.fn();
    const host = composeDesktopHost({
      logging: {
        verbosity: "trace",
        level: "info",
      },
      logSink: sink,
    });

    await host.loggingPort.log({
      timestamp: "2026-04-14T12:00:01.000Z",
      level: "info",
      verbosity: "normal",
      event: "upload.stored_successfully",
      message: "Upload stored successfully",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
      outcome: "success",
    });
    await host.loggingPort.log({
      timestamp: "2026-04-14T12:00:02.000Z",
      level: "error",
      verbosity: "normal",
      event: "upload.failed",
      message: "Upload failed",
      component: "store-image-upload-use-case",
      useCase: "store-image-upload",
      outcome: "failure",
    });

    expect(sink).toHaveBeenCalledTimes(2);
  });
});
