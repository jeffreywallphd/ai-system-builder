import { describe, expect, it } from "vitest";

import {
  KNOWN_RUNTIME_KINDS,
  createRuntimeExecutionError,
  createRuntimeExecutionFailureResult,
  createRuntimeExecutionProgressEvent,
  createRuntimeExecutionRequest,
  createRuntimeExecutionSuccessResult,
  createRuntimeTarget,
  isKnownRuntimeKind,
  resolveRuntimeKind,
} from ".";

describe("runtime contracts", () => {
  it("exposes known runtime kinds while allowing future adapter kinds", () => {
    expect(KNOWN_RUNTIME_KINDS).toEqual(["node", "python"]);
    expect(isKnownRuntimeKind("node")).toBe(true);
    expect(isKnownRuntimeKind("java")).toBe(false);
    expect(resolveRuntimeKind(undefined)).toBe("node");
    expect(resolveRuntimeKind(" PYTHON ")).toBe("python");
    expect(resolveRuntimeKind("java")).toBe("java");
  });

  it("creates runtime execution requests with target and correlation context", () => {
    const request = createRuntimeExecutionRequest(
      "assistant.plan",
      { prompt: "summarize" },
      {
        executionId: "exec-1",
        runtimeKind: "node",
        requestId: "req-1",
        correlationId: "corr-1",
        causationId: "cause-1",
        executionOptions: {
          timeoutMs: 1000,
          emitProgress: true,
          includeDiagnostics: true,
        },
        metadata: { source: "server-host" },
      },
    );

    expect(request).toEqual({
      executionId: "exec-1",
      operation: "assistant.plan",
      input: { prompt: "summarize" },
      target: {
        kind: "node",
        adapter: undefined,
        capability: undefined,
        metadata: undefined,
      },
      requestId: "req-1",
      correlationId: "corr-1",
      causationId: "cause-1",
      options: {
        timeoutMs: 1000,
        emitProgress: true,
        includeDiagnostics: true,
      },
      metadata: { source: "server-host" },
    });
  });

  it("creates runtime success and failure results from the shared result backbone", () => {
    const target = createRuntimeTarget("python", { adapter: "python-subprocess" });

    const success = createRuntimeExecutionSuccessResult(
      "tool.run",
      "exec-2",
      target,
      { stdout: "ok" },
      {
        completedAt: "2026-04-14T12:00:00.000Z",
        durationMs: 42,
        requestId: "req-2",
      },
    );

    expect(success).toEqual({
      ok: true,
      value: {
        output: { stdout: "ok" },
        completedAt: "2026-04-14T12:00:00.000Z",
        durationMs: 42,
        diagnostics: undefined,
      },
      requestId: "req-2",
      correlationId: undefined,
      operation: "tool.run",
      executionId: "exec-2",
      target: {
        kind: "python",
        adapter: "python-subprocess",
        capability: undefined,
        metadata: undefined,
      },
      metadata: undefined,
    });

    const error = createRuntimeExecutionError(
      "tool.run",
      "exec-2",
      target,
      "timeout",
      "Runtime exceeded timeout",
      {
        details: {
          phase: "execution",
          retryable: true,
          targetKind: "python",
        },
        requestId: "req-2",
      },
    );

    const failure = createRuntimeExecutionFailureResult(error, {
      correlationId: "corr-2",
    });

    expect(failure).toEqual({
      ok: false,
      error: {
        code: "timeout",
        message: "Runtime exceeded timeout",
        details: {
          phase: "execution",
          retryable: true,
          targetKind: "python",
        },
        requestId: "req-2",
        correlationId: undefined,
        operation: "tool.run",
        executionId: "exec-2",
        target: {
          kind: "python",
          adapter: "python-subprocess",
          capability: undefined,
          metadata: undefined,
        },
      },
      requestId: "req-2",
      correlationId: "corr-2",
      operation: "tool.run",
      executionId: "exec-2",
      target: {
        kind: "python",
        adapter: "python-subprocess",
        capability: undefined,
        metadata: undefined,
      },
      metadata: undefined,
    });
  });

  it("creates progress events with structured diagnostics aligned to logging contracts", () => {
    const event = createRuntimeExecutionProgressEvent(
      "tool.run",
      "exec-3",
      createRuntimeTarget("node"),
      "dispatch",
      {
        sequence: 1,
        percent: 25,
        diagnostic: {
          timestamp: "2026-04-14T12:00:01.000Z",
          level: "info",
          verbosity: "normal",
          event: "runtime.dispatch.started",
          message: "Dispatch started",
          component: "runtime-adapter",
        },
      },
    );

    expect(event.type).toBe("progress");
    expect(event).toMatchObject({
      operation: "tool.run",
      executionId: "exec-3",
      stage: "dispatch",
      sequence: 1,
      percent: 25,
      diagnostic: {
        level: "info",
        verbosity: "normal",
        event: "runtime.dispatch.started",
      },
    });
  });
});
