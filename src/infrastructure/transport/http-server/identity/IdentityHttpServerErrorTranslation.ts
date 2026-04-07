import {
  SharedApiErrorCodes,
  type SharedApiErrorCode,
  type SharedApiErrorShape,
} from "@shared/contracts/api/SharedApiContractPrimitives";

type ErrorPayload = {
  readonly code?: string;
  readonly message?: string;
  readonly validationErrors?: unknown;
  readonly [key: string]: unknown;
};

type ErrorEnvelope = {
  readonly ok: boolean;
  readonly error?: ErrorPayload;
  readonly [key: string]: unknown;
};

const SensitiveErrorMessagePattern =
  /([a-zA-Z]:\\|\/[A-Za-z0-9._-]+\/|password|secret|token|credential|stack|trace|sqlite|sql|exception)/i;

export function normalizeSharedApiErrorEnvelope(payload: unknown): unknown {
  if (!isErrorEnvelope(payload)) {
    return payload;
  }

  const error = payload.error ?? {};
  const domainCode = normalizeString(error.code);
  const sharedCode = mapToSharedApiErrorCode(domainCode);
  const safeMessage = resolveSafeMessage(sharedCode, normalizeString(error.message));
  const normalizedError: SharedApiErrorShape & Readonly<Record<string, unknown>> = Object.freeze({
    ...(error as Record<string, unknown>),
    code: domainCode ?? sharedCode,
    message: safeMessage,
    userMessage: resolveUserMessage(sharedCode),
    retryable: isRetryableSharedError(sharedCode),
    sharedCode,
    domainCode,
  });

  return Object.freeze({
    ...(payload as Record<string, unknown>),
    error: normalizedError,
  });
}

export function mapToSharedApiErrorCode(code: string | undefined): SharedApiErrorCode {
  const normalized = (code ?? "").toLowerCase();
  if (!normalized) {
    return SharedApiErrorCodes.internal;
  }
  if (normalized.includes("invalid") || normalized.endsWith("bad-request")) {
    return SharedApiErrorCodes.invalidRequest;
  }
  if (normalized.includes("auth") || normalized.includes("unauthorized")) {
    return SharedApiErrorCodes.authenticationFailed;
  }
  if (
    normalized.includes("forbidden")
    || normalized.includes("denied")
    || normalized.includes("rejected")
    || normalized.includes("unsupported-channel-purpose")
    || normalized.includes("inactive")
    || normalized.includes("secure-transport-required")
    || normalized.includes("origin-not-allowed")
  ) {
    return SharedApiErrorCodes.forbidden;
  }
  if (normalized.includes("not-found") || normalized.includes("missing")) {
    return SharedApiErrorCodes.notFound;
  }
  if (normalized.includes("conflict") || normalized.includes("already-exists")) {
    return SharedApiErrorCodes.conflict;
  }
  if (normalized.includes("rate-limit")) {
    return SharedApiErrorCodes.rateLimited;
  }
  if (
    normalized.includes("temporarily-unavailable")
    || normalized.includes("unavailable")
    || normalized.includes("timeout")
    || normalized.includes("retryable")
    || normalized.includes("transient")
  ) {
    return SharedApiErrorCodes.temporarilyUnavailable;
  }
  return SharedApiErrorCodes.internal;
}

export function mapSharedApiErrorCodeToStatusCode(code: SharedApiErrorCode): number {
  switch (code) {
    case SharedApiErrorCodes.invalidRequest:
      return 400;
    case SharedApiErrorCodes.authenticationFailed:
      return 401;
    case SharedApiErrorCodes.forbidden:
      return 403;
    case SharedApiErrorCodes.notFound:
      return 404;
    case SharedApiErrorCodes.conflict:
      return 409;
    case SharedApiErrorCodes.rateLimited:
      return 429;
    case SharedApiErrorCodes.temporarilyUnavailable:
      return 503;
    default:
      return 500;
  }
}

function isErrorEnvelope(payload: unknown): payload is ErrorEnvelope {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return record.ok === false && !!record.error && typeof record.error === "object" && !Array.isArray(record.error);
}

function resolveSafeMessage(sharedCode: SharedApiErrorCode, message: string | undefined): string {
  if (!message) {
    return resolveUserMessage(sharedCode);
  }
  if (SensitiveErrorMessagePattern.test(message)) {
    return resolveUserMessage(sharedCode);
  }
  return message;
}

function resolveUserMessage(sharedCode: SharedApiErrorCode): string {
  switch (sharedCode) {
    case SharedApiErrorCodes.invalidRequest:
      return "The request payload is invalid.";
    case SharedApiErrorCodes.authenticationFailed:
      return "Authentication is required or the session is no longer valid.";
    case SharedApiErrorCodes.forbidden:
      return "You do not have permission to perform this action.";
    case SharedApiErrorCodes.notFound:
      return "The requested resource was not found.";
    case SharedApiErrorCodes.conflict:
      return "The operation could not be completed because of a conflicting state.";
    case SharedApiErrorCodes.rateLimited:
      return "Too many requests were sent. Retry after a short delay.";
    case SharedApiErrorCodes.temporarilyUnavailable:
      return "The service is temporarily unavailable. Retry shortly.";
    default:
      return "The operation could not be completed due to an internal server error.";
  }
}

function isRetryableSharedError(sharedCode: SharedApiErrorCode): boolean {
  return sharedCode === SharedApiErrorCodes.rateLimited || sharedCode === SharedApiErrorCodes.temporarilyUnavailable;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
