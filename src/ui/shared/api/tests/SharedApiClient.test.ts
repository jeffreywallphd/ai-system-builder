import { describe, expect, it } from "bun:test";
import {
  SharedApiClient,
  SharedApiClientValidationError,
  parseSharedApiEnvelope,
} from "../SharedApiClient";

describe("SharedApiClient", () => {
  it("issues authenticated requests and returns envelope payloads", async () => {
    const requests: Array<{ readonly method: string; readonly url: string; readonly authorization?: string }> = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({
        method: String(init?.method ?? "GET"),
        url: String(input),
        authorization: headers?.authorization,
      });
      return new Response(JSON.stringify({ ok: true, data: { status: "ok" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788/",
      fetchImplementation,
    });

    const response = await client.requestJson<{ ok: boolean; data?: { status: string } }>({
      method: "GET",
      path: "/api/v1/health",
      sessionToken: "token-1",
    });

    expect(response.ok).toBeTrue();
    expect(response.data?.status).toBe("ok");
    expect(requests).toEqual([
      {
        method: "GET",
        url: "http://127.0.0.1:8788/api/v1/health",
        authorization: "Bearer token-1",
      },
    ]);
  });

  it("retries retryable GET responses and returns success", async () => {
    let attempts = 0;
    const fetchImplementation: typeof fetch = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({
          ok: false,
          error: {
            code: "temporarily-unavailable",
            message: "temporary",
            retryable: true,
          },
        }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, data: { attempt: attempts } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788",
      fetchImplementation,
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 0,
      },
    });

    const response = await client.requestJson<{ ok: boolean; data?: { attempt: number } }>({
      method: "GET",
      path: "/api/v1/retryable",
    });

    expect(attempts).toBe(2);
    expect(response.ok).toBeTrue();
    expect(response.data?.attempt).toBe(2);
  });

  it("normalizes transport failures into typed envelopes", async () => {
    const diagnostics: unknown[] = [];
    const fetchImplementation: typeof fetch = async () => {
      throw new Error("network unavailable");
    };
    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788",
      fetchImplementation,
      retryPolicy: {
        maxAttempts: 1,
      },
      onDiagnosticEvent: (event) => {
        diagnostics.push(event);
      },
    });

    const response = await client.requestJson<{ ok: boolean; error?: { code?: string; sharedCode?: string; retryable?: boolean } }>({
      method: "POST",
      path: "/api/v1/workspaces",
      body: { name: "alpha" },
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.sharedCode).toBe("temporarily-unavailable");
    expect(response.error?.retryable).toBeTrue();
    expect((response.error as { diagnostics?: { request?: { method?: string; path?: string } } } | undefined)?.diagnostics?.request?.method).toBe("POST");
    expect((response.error as { diagnostics?: { request?: { method?: string; path?: string } } } | undefined)?.diagnostics?.request?.path).toBe("/api/v1/workspaces");
    expect(diagnostics.length).toBeGreaterThan(0);
  });

  it("normalizes aborted requests", async () => {
    const fetchImplementation: typeof fetch = async (_input, init) => {
      if (init?.signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      throw new DOMException("aborted", "AbortError");
    };

    const controller = new AbortController();
    controller.abort();

    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788",
      fetchImplementation,
    });
    const response = await client.requestJson<{ ok: boolean; error?: { sharedCode?: string; domainCode?: string } }>({
      method: "GET",
      path: "/api/v1/cancelled",
      signal: controller.signal,
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.sharedCode).toBe("temporarily-unavailable");
    expect(response.error?.domainCode).toBe("request-cancelled");
  });

  it("normalizes timed out requests", async () => {
    const fetchImplementation: typeof fetch = async (_input, init) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (init?.signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      return new Response(JSON.stringify({ ok: true, data: { ignored: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788",
      fetchImplementation,
      retryPolicy: {
        maxAttempts: 1,
      },
    });
    const response = await client.requestJson<{ ok: boolean; error?: { sharedCode?: string; domainCode?: string } }>({
      method: "GET",
      path: "/api/v1/timeout",
      timeoutMs: 1,
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.sharedCode).toBe("temporarily-unavailable");
    expect(response.error?.domainCode).toBe("request-timeout");
  });

  it("maps parser failures to normalized internal errors", async () => {
    const client = new SharedApiClient({
      baseUrl: "http://127.0.0.1:8788",
      fetchImplementation: async () =>
        new Response(JSON.stringify({ ok: true, data: { value: "bad" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const response = await client.requestJson<{ ok: boolean; error?: { sharedCode?: string; domainCode?: string } }>({
      method: "GET",
      path: "/api/v1/example",
      parseResponse: () => {
        throw new Error("invalid");
      },
    });

    expect(response.ok).toBeFalse();
    expect(response.error?.sharedCode).toBe("internal");
    expect(response.error?.domainCode).toBe("response-schema-invalid");
  });
});

describe("parseSharedApiEnvelope", () => {
  it("throws a validation error for invalid envelopes", () => {
    expect(() => parseSharedApiEnvelope({ ok: "yes" })).toThrow(SharedApiClientValidationError);
  });
});
