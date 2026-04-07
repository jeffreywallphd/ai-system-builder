import type { RuntimeApiRequestContext, SystemRuntimeApiError, SystemRuntimeApiResponse } from "./SystemRuntimeBackendApi";

export const ExternalFailureClassifications = Object.freeze({
  retryableTransport: "retryable-transport",
  retryableCallbackDelivery: "retryable-callback-delivery",
  nonRetryableAuthorization: "non-retryable-authorization",
  nonRetryableValidation: "non-retryable-validation",
  nonRetryableQuota: "non-retryable-quota",
  nonRetryableRateLimit: "non-retryable-rate-limit",
  nonRetryableDuplicateRequest: "non-retryable-duplicate-request",
  nonRetryableUnknown: "non-retryable-unknown",
} as const);

export type ExternalFailureClassification = typeof ExternalFailureClassifications[keyof typeof ExternalFailureClassifications];

export interface RetryAttemptRecord {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly retryable: boolean;
  readonly classification: ExternalFailureClassification;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly classification: ExternalFailureClassification;
  readonly reason: string;
}

export interface ExternalRetryPolicy {
  readonly maxAttempts: number;
  classify(error: SystemRuntimeApiError): RetryDecision;
}

export interface ReplayGuardIdentity {
  readonly operation: "start-execution";
  readonly idempotencyKey: string;
  readonly callerId?: string;
  readonly tenantId?: string;
  readonly requestSource?: RuntimeApiRequestContext["requestSource"];
}

export interface RequestReplayGuard<T = unknown> {
  get(identity: ReplayGuardIdentity): SystemRuntimeApiResponse<T> | undefined;
  remember(identity: ReplayGuardIdentity, response: SystemRuntimeApiResponse<T>): void;
}

const DEFAULT_MAX_ATTEMPTS = 3;

export class BoundedExternalRetryPolicy implements ExternalRetryPolicy {
  public readonly maxAttempts: number;

  public constructor(maxAttempts = DEFAULT_MAX_ATTEMPTS) {
    this.maxAttempts = Number.isFinite(maxAttempts) ? Math.max(1, Math.floor(maxAttempts)) : DEFAULT_MAX_ATTEMPTS;
  }

  public classify(error: SystemRuntimeApiError): RetryDecision {
    switch (error.code) {
      case "internal":
        return Object.freeze({
          shouldRetry: true,
          classification: ExternalFailureClassifications.retryableTransport,
          reason: error.message || "External runtime transport or transient backend failure.",
        });
      case "unauthorized":
      case "forbidden":
        return Object.freeze({
          shouldRetry: false,
          classification: ExternalFailureClassifications.nonRetryableAuthorization,
          reason: error.message || "Authorization failure is non-retryable.",
        });
      case "invalid-request":
        return Object.freeze({
          shouldRetry: false,
          classification: ExternalFailureClassifications.nonRetryableValidation,
          reason: error.message || "Validation failure is non-retryable.",
        });
      case "quota-exceeded":
        return Object.freeze({
          shouldRetry: false,
          classification: ExternalFailureClassifications.nonRetryableQuota,
          reason: error.message || "Quota failure is non-retryable.",
        });
      case "rate-limit-exceeded":
        return Object.freeze({
          shouldRetry: false,
          classification: ExternalFailureClassifications.nonRetryableRateLimit,
          reason: error.message || "Rate limiting is non-retryable by this external retry layer.",
        });
      case "not-found":
      default:
        return Object.freeze({
          shouldRetry: false,
          classification: ExternalFailureClassifications.nonRetryableUnknown,
          reason: error.message || "Failure is non-retryable.",
        });
    }
  }
}

function replayGuardKey(identity: ReplayGuardIdentity): string {
  return [
    identity.operation,
    identity.idempotencyKey,
    identity.callerId?.trim() || "anonymous",
    identity.tenantId?.trim() || "none",
    identity.requestSource || "unknown",
  ].join("|");
}

export class InMemoryRequestReplayGuard<T = unknown> implements RequestReplayGuard<T> {
  private readonly responses = new Map<string, SystemRuntimeApiResponse<T>>();

  public get(identity: ReplayGuardIdentity): SystemRuntimeApiResponse<T> | undefined {
    return this.responses.get(replayGuardKey(identity));
  }

  public remember(identity: ReplayGuardIdentity, response: SystemRuntimeApiResponse<T>): void {
    this.responses.set(replayGuardKey(identity), response);
  }
}

export function buildRetryAttemptRecord(input: {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly decision: RetryDecision;
}): RetryAttemptRecord {
  return Object.freeze({
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    retryable: input.decision.shouldRetry,
    classification: input.decision.classification,
    reason: input.decision.reason,
    occurredAt: new Date().toISOString(),
  });
}
