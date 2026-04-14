import { describe, expect, it, vi } from "vitest";

import type { StructuredLogEvent } from "../../../../contracts/logging";

import type { LoggingPort } from "../logging.port";

describe("logging port", () => {
  it("accepts shared structured log events as the logging seam contract", async () => {
    const log = vi.fn();
    const port: LoggingPort = { log };

    const event: StructuredLogEvent = {
      timestamp: "2026-04-14T12:00:00.000Z",
      level: "info",
      verbosity: "normal",
      event: "runtime.execution.completed",
      message: "Execution completed",
      component: "runtime-adapter",
    };

    await port.log(event);

    expect(log).toHaveBeenCalledWith(event);
  });
});
