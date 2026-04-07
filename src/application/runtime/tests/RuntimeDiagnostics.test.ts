import { describe, expect, it } from "bun:test";
import {
  bindSafeFetch,
  normalizeRuntimeError,
} from "../RuntimeDiagnostics";
import { RuntimeDiagnosticsError } from "../RuntimeDiagnosticsError";

describe("RuntimeDiagnostics", () => {
  it("binds injected fetch implementations so browser-style this usage stays safe", async () => {
    const safeFetch = bindSafeFetch((async function (this: typeof globalThis) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation.");
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }) as typeof fetch);

    const response = await safeFetch("http://runtime.test/health");
    expect(response.ok).toBeTrue();
  });

  it("preserves original stack traces and nested causes when errors are wrapped", () => {
    const rootCause = new Error("Root cause message");
    rootCause.name = "RootCauseError";
    rootCause.stack = "RootCauseError: Root cause message\n    at root";

    const original = new Error("Outer failure", { cause: rootCause });
    original.name = "OuterFailure";
    original.stack = "OuterFailure: Outer failure\n    at outer";

    const wrapped = new RuntimeDiagnosticsError("Wrapped runtime failure", {
      name: "WrappedRuntimeError",
      cause: original,
      subsystem: "python-runtime",
      className: "HttpPythonRuntimeClient",
      methodName: "request",
      operation: "python-runtime-http-request",
    });

    expect(wrapped.diagnostics.stack).toBe("OuterFailure: Outer failure\n    at outer");
    expect(wrapped.diagnostics.causeChain).toHaveLength(2);
    expect(wrapped.diagnostics.causeChain[0]).toEqual({
      message: "Outer failure",
      name: "OuterFailure",
      stack: "OuterFailure: Outer failure\n    at outer",
    });
    expect(wrapped.diagnostics.causeChain[1]).toEqual({
      message: "Root cause message",
      name: "RootCauseError",
      stack: "RootCauseError: Root cause message\n    at root",
    });
  });

  it("normalizes wrapped runtime errors without discarding their original stack", () => {
    const original = new Error("Fetch exploded");
    original.stack = "Error: Fetch exploded\n    at request";
    const wrapped = new RuntimeDiagnosticsError("Python runtime request failed.", {
      cause: original,
      subsystem: "python-runtime",
      className: "HttpPythonRuntimeClient",
      methodName: "request",
      operation: "python-runtime-http-request",
      failedBeforeResponse: true,
      target: "/health",
      requestMethod: "GET",
    });

    const diagnostics = normalizeRuntimeError(wrapped, {
      subsystem: "python-runtime",
      className: "HttpPythonRuntimeClient",
      methodName: "request",
      operation: "python-runtime-http-request",
    });

    expect(diagnostics.stack).toBe("Error: Fetch exploded\n    at request");
    expect(diagnostics.failedBeforeResponse).toBeTrue();
    expect(diagnostics.target).toBe("/health");
    expect(diagnostics.requestMethod).toBe("GET");
  });
});
