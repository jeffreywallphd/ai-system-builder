import { describe, expect, it } from "vitest";

import {
  createApiError,
  createApiFailureResponse,
  createApiRequest,
  createApiSuccessResponse,
  resolveApiFailureKind,
} from ".";

describe("api contracts", () => {
  it("creates an api request that preserves transport-core operation semantics", () => {
    const request = createApiRequest(
      "workspace.create",
      { name: "alpha" },
      {
        requestId: "req-300",
        correlationId: "corr-300",
        metadata: { surface: "web-thin-client" },
      },
    );

    expect(request).toEqual({
      operation: "workspace.create",
      payload: { name: "alpha" },
      requestId: "req-300",
      correlationId: "corr-300",
      metadata: { surface: "web-thin-client" },
    });
  });

  it("maps contract error codes into api failure kinds for later http translation", () => {
    expect(resolveApiFailureKind("validation")).toBe("client");
    expect(resolveApiFailureKind("rate-limited")).toBe("transient");
    expect(resolveApiFailureKind("internal")).toBe("server");
  });

  it("creates an api error with specialized failure kind and transport envelope fields", () => {
    const error = createApiError(
      "workspace.create",
      "timeout",
      "Operation timed out",
      {
        details: { timeoutMs: 2000 },
        requestId: "req-301",
        metadata: { surface: "api" },
      },
    );

    expect(error).toEqual({
      operation: "workspace.create",
      code: "timeout",
      message: "Operation timed out",
      details: { timeoutMs: 2000 },
      requestId: "req-301",
      correlationId: undefined,
      metadata: { surface: "api" },
      kind: "transient",
    });
  });

  it("creates an api success response without introducing http-specific mechanics", () => {
    const response = createApiSuccessResponse(
      "workspace.create",
      { workspaceId: "ws-7" },
      {
        requestId: "req-302",
        correlationId: "corr-302",
      },
    );

    expect(response).toEqual({
      ok: true,
      value: { workspaceId: "ws-7" },
      requestId: "req-302",
      correlationId: "corr-302",
      operation: "workspace.create",
      metadata: undefined,
    });
  });

  it("creates an api failure response that preserves api failure kind", () => {
    const error = createApiError(
      "workspace.create",
      "unavailable",
      "Backend unavailable",
      {
        requestId: "req-303",
        metadata: { surface: "server-host" },
      },
    );

    const response = createApiFailureResponse(error, {
      correlationId: "corr-303",
    });

    expect(response).toEqual({
      ok: false,
      error: {
        operation: "workspace.create",
        code: "unavailable",
        message: "Backend unavailable",
        details: undefined,
        requestId: "req-303",
        correlationId: undefined,
        metadata: { surface: "server-host" },
        kind: "transient",
      },
      operation: "workspace.create",
      requestId: "req-303",
      correlationId: "corr-303",
      metadata: { surface: "server-host" },
    });
  });
});

