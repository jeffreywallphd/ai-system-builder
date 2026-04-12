import {
  SharedApiErrorCodes,
  type SharedApiErrorCode,
  type SharedApiErrorShape,
} from "@shared/contracts/api/SharedApiContractPrimitives";

type TransportErrorResponse = {
  readonly ok: boolean;
  readonly error?: {
    readonly code?: string;
  };
};

type TransportErrorStatusCodeByDomainCode = Readonly<Record<string, number>>;

export interface TransportErrorTranslationOptions {
  readonly successStatusCode?: number;
  readonly statusCodeByDomainCode?: TransportErrorStatusCodeByDomainCode;
  readonly fallbackStatusCode?: number;
}

export interface TransportErrorTranslationResult {
  readonly statusCode: number;
  readonly domainCode: string | undefined;
  readonly sharedCode: SharedApiErrorCode | undefined;
  readonly retryable: boolean;
}

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

const StandardAuthAndResourceStatusCodeByDomainCode = Object.freeze({
  "invalid-request": 400,
  "authentication-failed": 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
} satisfies Record<string, number>);

const IdentityAuthStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "account-inactive": 403,
  "unsupported-provider": 422,
} satisfies Record<string, number>);

const WorkspaceInvitationStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "invalid-invite": 400,
} satisfies Record<string, number>);

const WorkspaceAdministrationStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "invalid-transition": 422,
} satisfies Record<string, number>);

const StorageManagementStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "invalid-state": 422,
  "capability-unsupported": 422,
  "provisioning-failed": 409,
} satisfies Record<string, number>);

const AssetManagementStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "invalid-state": 422,
} satisfies Record<string, number>);

const ImageAssetManagementStatusCodeByDomainCode = Object.freeze({
  ...StandardAuthAndResourceStatusCodeByDomainCode,
  "invalid-state": 422,
} satisfies Record<string, number>);

const GeneratedResultManagementStatusCodeByDomainCode = Object.freeze({
  "invalid-request": 400,
  "authentication-failed": 401,
  forbidden: 403,
  "not-found": 404,
  "invalid-state": 422,
} satisfies Record<string, number>);

const AuditLedgerStatusCodeByDomainCode = Object.freeze({
  "invalid-request": 400,
  "authentication-failed": 401,
  forbidden: 403,
  "not-found": 404,
} satisfies Record<string, number>);

const SystemRuntimeStatusCodeByDomainCode = Object.freeze({
  "invalid-request": 400,
  unauthorized: 401,
  forbidden: 403,
  "not-found": 404,
  "quota-exceeded": 429,
  "rate-limit-exceeded": 429,
} satisfies Record<string, number>);

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

export function translateTransportError(
  response: TransportErrorResponse,
  options: TransportErrorTranslationOptions = {},
): TransportErrorTranslationResult {
  const successStatusCode = options.successStatusCode ?? 200;
  if (response.ok) {
    return Object.freeze({
      statusCode: successStatusCode,
      domainCode: undefined,
      sharedCode: undefined,
      retryable: false,
    });
  }

  const domainCode = normalizeString(response.error?.code);
  const sharedCode = mapToSharedApiErrorCode(domainCode);
  const normalizedDomainCode = domainCode?.toLowerCase();
  const statusCodeByDomainCode = options.statusCodeByDomainCode;
  const explicitStatusCode = normalizedDomainCode
    ? statusCodeByDomainCode?.[normalizedDomainCode]
    : undefined;
  const fallbackStatusCode = options.fallbackStatusCode
    ?? mapSharedApiErrorCodeToStatusCode(sharedCode);

  return Object.freeze({
    statusCode: explicitStatusCode ?? fallbackStatusCode,
    domainCode,
    sharedCode,
    retryable: isRetryableSharedError(sharedCode),
  });
}

function resolveTransportErrorStatusCode(
  response: TransportErrorResponse,
  options: TransportErrorTranslationOptions,
): number {
  return translateTransportError(response, options).statusCode;
}

export function mapIdentityAuthApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: IdentityAuthStatusCodeByDomainCode,
  });
}

export function mapWorkspaceInvitationApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: WorkspaceInvitationStatusCodeByDomainCode,
  });
}

export function mapWorkspaceAdministrationApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: WorkspaceAdministrationStatusCodeByDomainCode,
  });
}

export function mapAuthorizationManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StandardAuthAndResourceStatusCodeByDomainCode,
  });
}

export function mapNodeTrustApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StandardAuthAndResourceStatusCodeByDomainCode,
  });
}

export function mapExecutionNodeManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StandardAuthAndResourceStatusCodeByDomainCode,
  });
}

export function mapCertificateOperationsApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StandardAuthAndResourceStatusCodeByDomainCode,
  });
}

export function mapSecretMetadataApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StandardAuthAndResourceStatusCodeByDomainCode,
  });
}

export function mapStorageManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: StorageManagementStatusCodeByDomainCode,
  });
}

export function mapAssetManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: AssetManagementStatusCodeByDomainCode,
  });
}

export function mapImageAssetManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: ImageAssetManagementStatusCodeByDomainCode,
  });
}

export function mapGeneratedResultManagementApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: GeneratedResultManagementStatusCodeByDomainCode,
  });
}

export function mapAuditLedgerApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: AuditLedgerStatusCodeByDomainCode,
  });
}

export function mapSystemRuntimeApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {
    statusCodeByDomainCode: SystemRuntimeStatusCodeByDomainCode,
    fallbackStatusCode: 500,
  });
}

export function mapRunSubmissionApiStatusCode(response: TransportErrorResponse): number {
  return resolveTransportErrorStatusCode(response, {});
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
