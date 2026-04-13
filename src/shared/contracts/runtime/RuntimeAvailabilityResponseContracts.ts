export class RuntimeAvailabilityResponseContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeAvailabilityResponseContractError";
  }
}

export const RuntimeAvailabilityResponseContractVersions = Object.freeze({
  v1: "runtime-availability-response/v1",
} as const);

export type RuntimeAvailabilityResponseContractVersion =
  typeof RuntimeAvailabilityResponseContractVersions[keyof typeof RuntimeAvailabilityResponseContractVersions];

export const RuntimeAvailabilityStates = Object.freeze({
  unavailable: "unavailable",
  warming: "warming",
  ready: "ready",
  failed: "failed",
} as const);

export type RuntimeAvailabilityState = typeof RuntimeAvailabilityStates[keyof typeof RuntimeAvailabilityStates];

export const RuntimeAvailabilityBlockingReasonCodes = Object.freeze({
  authenticationRequired: "authentication-required",
  capabilityWarmupInProgress: "capability-warmup-in-progress",
  runtimeNotRequested: "runtime-not-requested",
  policyRestricted: "policy-restricted",
  dependencyUnavailable: "dependency-unavailable",
  shutdownInProgress: "shutdown-in-progress",
  runtimeInitializationFailed: "runtime-initialization-failed",
  unknown: "unknown",
} as const);

export type RuntimeAvailabilityBlockingReasonCode =
  typeof RuntimeAvailabilityBlockingReasonCodes[keyof typeof RuntimeAvailabilityBlockingReasonCodes];

export interface RuntimeAvailabilityBlockingReason {
  readonly code: RuntimeAvailabilityBlockingReasonCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly observedAt?: string;
}

export interface RuntimeAvailabilityFailureDetail {
  readonly code: string;
  readonly message: string;
  readonly failedAt: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
}

interface RuntimeAvailabilityResponseBase {
  readonly contractVersion: RuntimeAvailabilityResponseContractVersion;
  readonly state: RuntimeAvailabilityState;
  readonly checkedAt: string;
  readonly updatedAt: string;
  readonly retryable: boolean;
  readonly blockingReasons: ReadonlyArray<RuntimeAvailabilityBlockingReason>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface RuntimeUnavailableResponseContract extends RuntimeAvailabilityResponseBase {
  readonly state: typeof RuntimeAvailabilityStates.unavailable;
}

export interface RuntimeWarmingResponseContract extends RuntimeAvailabilityResponseBase {
  readonly state: typeof RuntimeAvailabilityStates.warming;
  readonly warmupStartedAt?: string;
}

export interface RuntimeReadyResponseContract extends RuntimeAvailabilityResponseBase {
  readonly state: typeof RuntimeAvailabilityStates.ready;
  readonly readyAt: string;
}

export interface RuntimeFailedResponseContract extends RuntimeAvailabilityResponseBase {
  readonly state: typeof RuntimeAvailabilityStates.failed;
  readonly failure: RuntimeAvailabilityFailureDetail;
}

export type RuntimeAvailabilityResponseContract =
  | RuntimeUnavailableResponseContract
  | RuntimeWarmingResponseContract
  | RuntimeReadyResponseContract
  | RuntimeFailedResponseContract;

export type RuntimeUnavailableLifecycleResponseContract = Exclude<
  RuntimeAvailabilityResponseContract,
  RuntimeReadyResponseContract
>;

export interface RuntimeReadinessResponseContract {
  readonly runtime: RuntimeAvailabilityResponseContract;
}

export interface RuntimeGuardedEndpointUnavailableResponseContract {
  readonly endpoint: string;
  readonly blockedAt: string;
  readonly runtime: RuntimeUnavailableLifecycleResponseContract;
  readonly requestId?: string;
}

function normalizeRequired(input: string, field: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw new RuntimeAvailabilityResponseContractError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(input: string, field: string): string {
  const parsed = new Date(normalizeRequired(input, field));
  if (Number.isNaN(parsed.getTime())) {
    throw new RuntimeAvailabilityResponseContractError(`${field} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeRetryAfterMs(input: number | undefined, field: string): number | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Number.isFinite(input) || input < 0) {
    throw new RuntimeAvailabilityResponseContractError(`${field} must be a non-negative finite number.`);
  }
  return Math.floor(input);
}

function normalizeBlockingReason(
  reason: RuntimeAvailabilityBlockingReason,
): RuntimeAvailabilityBlockingReason {
  return Object.freeze({
    code: reason.code,
    message: normalizeRequired(reason.message, "Runtime blocking reason message"),
    retryable: reason.retryable,
    retryAfterMs: normalizeRetryAfterMs(reason.retryAfterMs, "Runtime blocking reason retryAfterMs"),
    observedAt: reason.observedAt
      ? normalizeIsoTimestamp(reason.observedAt, "Runtime blocking reason observedAt")
      : undefined,
  });
}

function normalizeBlockingReasons(
  reasons: ReadonlyArray<RuntimeAvailabilityBlockingReason> | undefined,
): ReadonlyArray<RuntimeAvailabilityBlockingReason> {
  if (!reasons || reasons.length === 0) {
    return Object.freeze([]);
  }
  return Object.freeze(reasons.map((reason) => normalizeBlockingReason(reason)));
}

function createBaseAvailabilityResponse(input: {
  readonly state: RuntimeAvailabilityState;
  readonly checkedAt?: string;
  readonly updatedAt?: string;
  readonly retryable: boolean;
  readonly blockingReasons?: ReadonlyArray<RuntimeAvailabilityBlockingReason>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}): RuntimeAvailabilityResponseBase {
  const checkedAt = normalizeIsoTimestamp(input.checkedAt ?? new Date().toISOString(), "Runtime availability checkedAt");
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? checkedAt, "Runtime availability updatedAt");
  return Object.freeze({
    contractVersion: RuntimeAvailabilityResponseContractVersions.v1,
    state: input.state,
    checkedAt,
    updatedAt,
    retryable: input.retryable,
    blockingReasons: normalizeBlockingReasons(input.blockingReasons),
    diagnostics: input.diagnostics
      ? Object.freeze({ ...input.diagnostics })
      : undefined,
  });
}

export function createRuntimeUnavailableResponseContract(input?: {
  readonly checkedAt?: string;
  readonly updatedAt?: string;
  readonly blockingReasons?: ReadonlyArray<RuntimeAvailabilityBlockingReason>;
  readonly retryable?: boolean;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}): RuntimeUnavailableResponseContract {
  return Object.freeze({
    ...createBaseAvailabilityResponse({
      state: RuntimeAvailabilityStates.unavailable,
      checkedAt: input?.checkedAt,
      updatedAt: input?.updatedAt,
      retryable: input?.retryable ?? false,
      blockingReasons: input?.blockingReasons,
      diagnostics: input?.diagnostics,
    }),
    state: RuntimeAvailabilityStates.unavailable,
  });
}

export function createRuntimeWarmingResponseContract(input?: {
  readonly checkedAt?: string;
  readonly updatedAt?: string;
  readonly warmupStartedAt?: string;
  readonly blockingReasons?: ReadonlyArray<RuntimeAvailabilityBlockingReason>;
  readonly retryable?: boolean;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}): RuntimeWarmingResponseContract {
  const blockingReasons = input?.blockingReasons ?? Object.freeze([Object.freeze({
    code: RuntimeAvailabilityBlockingReasonCodes.capabilityWarmupInProgress,
    message: "Runtime capability warmup is still in progress.",
    retryable: true,
  })]);

  return Object.freeze({
    ...createBaseAvailabilityResponse({
      state: RuntimeAvailabilityStates.warming,
      checkedAt: input?.checkedAt,
      updatedAt: input?.updatedAt,
      retryable: input?.retryable ?? true,
      blockingReasons,
      diagnostics: input?.diagnostics,
    }),
    state: RuntimeAvailabilityStates.warming,
    warmupStartedAt: input?.warmupStartedAt
      ? normalizeIsoTimestamp(input.warmupStartedAt, "Runtime warmupStartedAt")
      : undefined,
  });
}

export function createRuntimeReadyResponseContract(input?: {
  readonly checkedAt?: string;
  readonly updatedAt?: string;
  readonly readyAt?: string;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}): RuntimeReadyResponseContract {
  const base = createBaseAvailabilityResponse({
    state: RuntimeAvailabilityStates.ready,
    checkedAt: input?.checkedAt,
    updatedAt: input?.updatedAt,
    retryable: false,
    blockingReasons: Object.freeze([]),
    diagnostics: input?.diagnostics,
  });
  return Object.freeze({
    ...base,
    state: RuntimeAvailabilityStates.ready,
    readyAt: normalizeIsoTimestamp(input?.readyAt ?? base.updatedAt, "Runtime readyAt"),
  });
}

export function createRuntimeFailedResponseContract(input: {
  readonly checkedAt?: string;
  readonly updatedAt?: string;
  readonly blockingReasons?: ReadonlyArray<RuntimeAvailabilityBlockingReason>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
  readonly failure: RuntimeAvailabilityFailureDetail;
}): RuntimeFailedResponseContract {
  const failure = Object.freeze({
    code: normalizeRequired(input.failure.code, "Runtime failure code"),
    message: normalizeRequired(input.failure.message, "Runtime failure message"),
    failedAt: normalizeIsoTimestamp(input.failure.failedAt, "Runtime failure failedAt"),
    retryable: input.failure.retryable,
    retryAfterMs: normalizeRetryAfterMs(input.failure.retryAfterMs, "Runtime failure retryAfterMs"),
  });

  return Object.freeze({
    ...createBaseAvailabilityResponse({
      state: RuntimeAvailabilityStates.failed,
      checkedAt: input.checkedAt,
      updatedAt: input.updatedAt ?? failure.failedAt,
      retryable: failure.retryable,
      blockingReasons: input.blockingReasons ?? Object.freeze([Object.freeze({
        code: RuntimeAvailabilityBlockingReasonCodes.runtimeInitializationFailed,
        message: "Runtime capability activation failed.",
        retryable: failure.retryable,
        retryAfterMs: failure.retryAfterMs,
        observedAt: failure.failedAt,
      })]),
      diagnostics: input.diagnostics,
    }),
    state: RuntimeAvailabilityStates.failed,
    failure,
  });
}

export function isRuntimeAvailabilityReady(
  response: RuntimeAvailabilityResponseContract,
): response is RuntimeReadyResponseContract {
  return response.state === RuntimeAvailabilityStates.ready;
}

export function isRuntimeAvailabilityUnavailable(
  response: RuntimeAvailabilityResponseContract,
): response is RuntimeUnavailableLifecycleResponseContract {
  return response.state !== RuntimeAvailabilityStates.ready;
}

export function createRuntimeGuardedEndpointUnavailableResponseContract(input: {
  readonly endpoint: string;
  readonly blockedAt?: string;
  readonly requestId?: string;
  readonly runtime: RuntimeUnavailableLifecycleResponseContract;
}): RuntimeGuardedEndpointUnavailableResponseContract {
  return Object.freeze({
    endpoint: normalizeRequired(input.endpoint, "Runtime guarded endpoint"),
    blockedAt: normalizeIsoTimestamp(input.blockedAt ?? new Date().toISOString(), "Runtime guarded endpoint blockedAt"),
    requestId: input.requestId?.trim() ? input.requestId.trim() : undefined,
    runtime: input.runtime,
  });
}
