import type { IncomingMessage, ServerResponse } from "node:http";

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";
const MAX_CORRELATION_ID_LENGTH = 128;

function normalizeOptionalHeader(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = candidate?.trim();
  return normalized ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function setResponseCorrelationHeaders(response: ServerResponse, requestId: string, correlationId: string): void {
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
}

export function resolveRequestCorrelationId(request: IncomingMessage, fallback: string): string {
  const candidate = normalizeOptionalHeader(request.headers[CORRELATION_ID_HEADER])
    ?? normalizeOptionalHeader(request.headers[REQUEST_ID_HEADER]);
  if (!candidate) {
    return fallback;
  }

  const normalized = candidate.trim().slice(0, MAX_CORRELATION_ID_LENGTH);
  if (!normalized || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    return fallback;
  }
  return normalized;
}

export function addCorrelationIdToErrorEnvelope(payload: unknown, correlationId: string | undefined): unknown {
  if (!correlationId) {
    return payload;
  }
  const payloadRecord = asRecord(payload);
  if (!payloadRecord) {
    return payload;
  }
  const error = asRecord(payloadRecord.error);
  if (!error) {
    return payload;
  }

  return Object.freeze({
    ...payloadRecord,
    error: Object.freeze({
      ...error,
      correlationId,
    }),
  });
}

export function normalizeResponseHeaderValue(value: number | string | string[] | undefined): string | undefined {
  if (typeof value === "number") {
    return undefined;
  }
  return normalizeOptionalHeader(value);
}
