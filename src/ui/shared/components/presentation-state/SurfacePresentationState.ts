import { SharedApiErrorCodes } from "@shared/contracts/api/SharedApiContractPrimitives";

export type SurfacePresentationStateKind =
  | "loading"
  | "empty"
  | "not-found"
  | "error"
  | "disconnected"
  | "permission-denied";

export interface SurfacePresentationState {
  readonly kind: SurfacePresentationStateKind;
  readonly title: string;
  readonly message: string;
  readonly details?: string;
  readonly retryable?: boolean;
}

export interface SurfaceApiErrorLike {
  readonly code?: string;
  readonly sharedCode?: string;
  readonly domainCode?: string;
  readonly message?: string;
  readonly userMessage?: string;
  readonly retryable?: boolean;
}

export interface SurfaceApiErrorStateOptions {
  readonly fallbackTitle: string;
  readonly fallbackMessage: string;
}

export function createLoadingState(title: string, message: string): SurfacePresentationState {
  return Object.freeze({
    kind: "loading",
    title,
    message,
  });
}

export function createEmptyState(title: string, message: string): SurfacePresentationState {
  return Object.freeze({
    kind: "empty",
    title,
    message,
  });
}

export function toSurfacePresentationStateFromApiError(
  error: SurfaceApiErrorLike | undefined,
  options: SurfaceApiErrorStateOptions,
): SurfacePresentationState {
  const sharedCode = normalizeCode(error?.sharedCode ?? error?.code);
  const domainCode = normalizeCode(error?.domainCode);
  const message = normalizeMessage(error?.userMessage) ?? normalizeMessage(error?.message) ?? options.fallbackMessage;

  if (
    sharedCode === SharedApiErrorCodes.forbidden
    || sharedCode === SharedApiErrorCodes.authenticationFailed
    || domainCode === SharedApiErrorCodes.forbidden
    || domainCode === SharedApiErrorCodes.authenticationFailed
  ) {
    return Object.freeze({
      kind: "permission-denied",
      title: "Permission required",
      message,
      details: toDetails(error, sharedCode, domainCode),
    });
  }

  if (sharedCode === SharedApiErrorCodes.notFound || domainCode === SharedApiErrorCodes.notFound) {
    return Object.freeze({
      kind: "not-found",
      title: "Not found",
      message,
      details: toDetails(error, sharedCode, domainCode),
    });
  }

  if (isDisconnected(sharedCode, domainCode)) {
    return Object.freeze({
      kind: "disconnected",
      title: "Service unavailable",
      message,
      retryable: true,
      details: toDetails(error, sharedCode, domainCode),
    });
  }

  return Object.freeze({
    kind: "error",
    title: options.fallbackTitle,
    message,
    retryable: error?.retryable,
    details: toDetails(error, sharedCode, domainCode),
  });
}

export function toDisconnectedState(title: string, message: string): SurfacePresentationState {
  return Object.freeze({
    kind: "disconnected",
    title,
    message,
    retryable: true,
  });
}

function normalizeCode(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function normalizeMessage(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isDisconnected(sharedCode: string | undefined, domainCode: string | undefined): boolean {
  if (sharedCode === SharedApiErrorCodes.temporarilyUnavailable || sharedCode === SharedApiErrorCodes.rateLimited) {
    return true;
  }

  return [sharedCode, domainCode].some((code) => {
    if (!code) {
      return false;
    }
    return code.includes("unavailable")
      || code.includes("transport")
      || code.includes("network")
      || code.includes("timeout")
      || code.includes("cancelled")
      || code.includes("canceled");
  });
}

function toDetails(
  error: SurfaceApiErrorLike | undefined,
  sharedCode: string | undefined,
  domainCode: string | undefined,
): string | undefined {
  const detailTokens = [
    sharedCode ? `shared:${sharedCode}` : undefined,
    domainCode && domainCode !== sharedCode ? `domain:${domainCode}` : undefined,
  ].filter((token): token is string => typeof token === "string" && token.length > 0);

  if (detailTokens.length > 0) {
    return detailTokens.join(" | ");
  }

  const fallbackCode = normalizeCode(error?.code);
  return fallbackCode ? `code:${fallbackCode}` : undefined;
}
