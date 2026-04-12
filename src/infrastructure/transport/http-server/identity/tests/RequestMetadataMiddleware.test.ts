import { describe, expect, it } from "bun:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
  addCorrelationIdToErrorEnvelope,
  normalizeResponseHeaderValue,
  resolveRequestCorrelationId,
  setResponseCorrelationHeaders,
} from "../middleware/request-metadata";

function createRequest(headers: IncomingMessage["headers"]): IncomingMessage {
  return { headers } as IncomingMessage;
}

function createResponseStub(): ServerResponse {
  const headers = new Map<string, string | string[] | number>();
  return {
    setHeader: (name: string, value: string | string[] | number) => {
      headers.set(name, value);
      return undefined as unknown as ServerResponse;
    },
    getHeader: (name: string) => headers.get(name),
  } as unknown as ServerResponse;
}

describe("request-metadata middleware utilities", () => {
  it("prefers x-correlation-id over x-request-id and enforces safe format", () => {
    const request = createRequest({
      [CORRELATION_ID_HEADER]: "  corr-id.123  ",
      [REQUEST_ID_HEADER]: "request-fallback",
    });

    expect(resolveRequestCorrelationId(request, "generated")).toBe("corr-id.123");
  });

  it("falls back to generated request id when correlation headers are invalid", () => {
    const request = createRequest({
      [CORRELATION_ID_HEADER]: "invalid value with spaces",
    });

    expect(resolveRequestCorrelationId(request, "generated-id")).toBe("generated-id");
  });

  it("writes request and correlation identifiers onto the response headers", () => {
    const response = createResponseStub();
    setResponseCorrelationHeaders(response, "req-1", "corr-1");

    expect(response.getHeader(REQUEST_ID_HEADER)).toBe("req-1");
    expect(response.getHeader(CORRELATION_ID_HEADER)).toBe("corr-1");
  });

  it("adds correlation metadata only when an error envelope is present", () => {
    const payload = Object.freeze({
      ok: false,
      error: Object.freeze({
        code: "invalid-request",
        message: "Missing field.",
      }),
    });

    const withCorrelation = addCorrelationIdToErrorEnvelope(payload, "corr-22") as {
      readonly error: { readonly correlationId?: string };
    };
    expect(withCorrelation.error.correlationId).toBe("corr-22");
    expect(addCorrelationIdToErrorEnvelope({ ok: true }, "corr-22")).toEqual({ ok: true });
  });

  it("normalizes response header values for correlation extraction", () => {
    expect(normalizeResponseHeaderValue(" corr-8 ")).toBe("corr-8");
    expect(normalizeResponseHeaderValue(["corr-9"])).toBe("corr-9");
    expect(normalizeResponseHeaderValue(42)).toBeUndefined();
  });
});
