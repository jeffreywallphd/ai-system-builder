import { describe, expect, it } from "bun:test";
import {
  formatPostLoginActivationDiagnosticMessage,
  logPostLoginActivationDiagnostic,
  summarizeActivationError,
} from "../runtime/PostLoginActivationDiagnostics";

describe("PostLoginActivationDiagnostics", () => {
  it("formats structured startup diagnostic messages with stable key-value fields", () => {
    const message = formatPostLoginActivationDiagnosticMessage({
      event: "desktop.post-login-activation.stage.started",
      stageId: "python-runtime-resolution",
      startedAt: "2026-04-13T12:00:00.000Z",
      blockingDependency: "python-runtime",
      dependencies: Object.freeze(["desktop-storage", "python-runtime"]),
      detail: "Resolving desktop Python runtime.",
    });

    expect(message).toContain("[ai-loom][startup]");
    expect(message).toContain("event=\"desktop.post-login-activation.stage.started\"");
    expect(message).toContain("stageId=\"python-runtime-resolution\"");
    expect(message).toContain("blockingDependency=\"python-runtime\"");
    expect(message).toContain("dependencies=[\"desktop-storage\",\"python-runtime\"]");
    expect(message).toContain("detail=\"Resolving desktop Python runtime.\"");
  });

  it("summarizes activation errors with cause details", () => {
    const error = new Error("stage failed", { cause: new Error("dependency unavailable") });
    const summary = summarizeActivationError(error);

    expect(summary).toEqual({
      errorName: "Error",
      errorMessage: "stage failed",
      errorCause: "dependency unavailable",
    });
  });

  it("routes diagnostics to info or error logger methods", () => {
    const calls: string[] = [];
    const logger = {
      info: (message?: unknown) => calls.push(`info:${String(message)}`),
      error: (message?: unknown) => calls.push(`error:${String(message)}`),
    };

    logPostLoginActivationDiagnostic({
      logger,
      payload: {
        event: "desktop.post-login-activation.warmup.started",
      },
    });
    logPostLoginActivationDiagnostic({
      logger,
      level: "error",
      payload: {
        event: "desktop.post-login-activation.warmup.failed",
        errorMessage: "activation failed",
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("info:[ai-loom][startup]");
    expect(calls[0]).toContain("event=\"desktop.post-login-activation.warmup.started\"");
    expect(calls[1]).toContain("error:[ai-loom][startup]");
    expect(calls[1]).toContain("event=\"desktop.post-login-activation.warmup.failed\"");
    expect(calls[1]).toContain("errorMessage=\"activation failed\"");
  });
});
