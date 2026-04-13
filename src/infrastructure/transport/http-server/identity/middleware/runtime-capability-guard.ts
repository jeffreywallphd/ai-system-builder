import {
  RuntimeAvailabilityBlockingDependencyCategories,
  RuntimeAvailabilityBlockingReasonCodes,
  createRuntimeFailedResponseContract,
  createRuntimeGuardedEndpointUnavailableResponseContract,
  createRuntimeUnavailableResponseContract,
  createRuntimeWarmingResponseContract,
  type RuntimeAvailabilityBlockingReason,
  type RuntimeAvailabilityLifecycleDiagnostics,
  type RuntimeGuardedEndpointUnavailableResponseContract,
  type RuntimeUnavailableLifecycleResponseContract,
} from "@shared/contracts/runtime/RuntimeAvailabilityResponseContracts";

const RuntimeGuardedRouteFamilies = new Set<string>([
  "system-runtime",
  "run-submission",
  "run-read",
  "run-mutation",
  "run-execution-update",
  "image-run-api",
]);

type RuntimeCapabilityState = "ready" | "available" | "unavailable" | "warming" | "pending" | "failed" | "pre-login";

export interface RuntimeCapabilityGuardAvailability {
  readonly routeFamilyId: string;
  readonly capabilityId?: string;
  readonly state?: string;
  readonly runtimeLifecycle?: {
    readonly capabilityPhase: string;
    readonly transportPhase?: string;
    readonly activationMode?: string;
    readonly triggerSource?: string;
    readonly unavailableReason?: string;
    readonly hasFailure?: boolean;
    readonly failureRetryable?: boolean;
  };
  readonly available: boolean;
}

export interface EvaluateRuntimeCapabilityGuardInput {
  readonly endpoint: string;
  readonly requestId: string;
  readonly routeFamilyId: string;
  readonly availability?: RuntimeCapabilityGuardAvailability;
  readonly checkedAt?: string;
}

export interface RuntimeCapabilityGuardDecision {
  readonly blocked: boolean;
  readonly response?: RuntimeGuardedEndpointUnavailableResponseContract;
  readonly runtimeState?: RuntimeUnavailableLifecycleResponseContract["state"];
}

function normalizeRuntimeState(value: string | undefined): RuntimeCapabilityState {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "ready":
    case "available":
      return "available";
    case "warming":
      return "warming";
    case "pending":
      return "pending";
    case "failed":
      return "failed";
    case "pre-login":
      return "pre-login";
    case "unavailable":
      return "unavailable";
    default:
      return "unavailable";
  }
}

function buildBlockingReason(input: {
  readonly code: typeof RuntimeAvailabilityBlockingReasonCodes[keyof typeof RuntimeAvailabilityBlockingReasonCodes];
  readonly message: string;
  readonly retryable: boolean;
  readonly observedAt: string;
  readonly retryAfterMs?: number;
}): RuntimeAvailabilityBlockingReason {
  return Object.freeze({
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    observedAt: input.observedAt,
    retryAfterMs: input.retryAfterMs,
  });
}

function resolveUnavailableLifecycleResponse(input: {
  readonly checkedAt: string;
  readonly availability?: RuntimeCapabilityGuardAvailability;
}): RuntimeUnavailableLifecycleResponseContract {
  const runtimeCapabilityState = normalizeRuntimeState(input.availability?.state);
  const runtimeLifecycleState = mapCapabilityStateToRuntimeLifecycleState(runtimeCapabilityState);
  const capabilityDescription = input.availability?.capabilityId
    ? `runtime capability '${input.availability.capabilityId}'`
    : "runtime capability";
  const diagnostics = buildLifecycleDiagnostics({
    availability: input.availability,
    runtimeState: runtimeLifecycleState,
  });

  if (runtimeCapabilityState === "failed") {
    const retryable = diagnostics.retryable;
    const failureReason = buildBlockingReason({
      code: RuntimeAvailabilityBlockingReasonCodes.runtimeInitializationFailed,
      message: `Deferred ${capabilityDescription} activation failed.`,
      retryable,
      observedAt: input.checkedAt,
    });
    return createRuntimeFailedResponseContract({
      checkedAt: input.checkedAt,
      updatedAt: input.checkedAt,
      blockingReasons: Object.freeze([failureReason]),
      failure: Object.freeze({
        code: "runtime-capability-activation-failed",
        message: `Deferred ${capabilityDescription} activation failed.`,
        failedAt: input.checkedAt,
        retryable,
      }),
      diagnostics,
    });
  }

  if (runtimeCapabilityState === "warming" || runtimeCapabilityState === "pending") {
    const warmupReason = buildBlockingReason({
      code: RuntimeAvailabilityBlockingReasonCodes.capabilityWarmupInProgress,
      message: `Deferred ${capabilityDescription} activation is still warming.`,
      retryable: true,
      observedAt: input.checkedAt,
      retryAfterMs: 1000,
    });
    return createRuntimeWarmingResponseContract({
      checkedAt: input.checkedAt,
      updatedAt: input.checkedAt,
      warmupStartedAt: input.checkedAt,
      blockingReasons: Object.freeze([warmupReason]),
      diagnostics,
    });
  }

  if (runtimeCapabilityState === "pre-login") {
    const authReason = buildBlockingReason({
      code: RuntimeAvailabilityBlockingReasonCodes.authenticationRequired,
      message: `Deferred ${capabilityDescription} activation requires an authenticated session.`,
      retryable: true,
      observedAt: input.checkedAt,
    });
    return createRuntimeUnavailableResponseContract({
      checkedAt: input.checkedAt,
      updatedAt: input.checkedAt,
      retryable: true,
      blockingReasons: Object.freeze([authReason]),
      diagnostics,
    });
  }

  const unavailableReason = buildBlockingReason({
    code: RuntimeAvailabilityBlockingReasonCodes.runtimeNotRequested,
    message: `Deferred ${capabilityDescription} is not yet active for route family '${input.availability?.routeFamilyId}'.`,
    retryable: true,
    observedAt: input.checkedAt,
  });
  return createRuntimeUnavailableResponseContract({
    checkedAt: input.checkedAt,
    updatedAt: input.checkedAt,
    retryable: true,
    blockingReasons: Object.freeze([unavailableReason]),
    diagnostics,
  });
}

function mapCapabilityStateToRuntimeLifecycleState(
  runtimeState: RuntimeCapabilityState,
): RuntimeUnavailableLifecycleResponseContract["state"] {
  if (runtimeState === "failed") {
    return "failed";
  }
  if (runtimeState === "warming" || runtimeState === "pending") {
    return "warming";
  }
  return "unavailable";
}

function buildLifecycleDiagnostics(input: {
  readonly availability?: RuntimeCapabilityGuardAvailability;
  readonly runtimeState: RuntimeUnavailableLifecycleResponseContract["state"];
}): RuntimeAvailabilityLifecycleDiagnostics {
  const blockingDependencyCategory = resolveBlockingDependencyCategory(input);
  const retryable = input.runtimeState === "failed"
    ? input.availability?.runtimeLifecycle?.failureRetryable ?? true
    : true;

  return Object.freeze({
    lifecycleState: input.runtimeState,
    blockingDependencyCategory,
    retryable,
    summary: buildLifecycleSummary({
      runtimeState: input.runtimeState,
      blockingDependencyCategory,
      availability: input.availability,
    }),
    routeFamilyId: input.availability?.routeFamilyId,
    capabilityId: input.availability?.capabilityId,
    lifecyclePhase: input.availability?.runtimeLifecycle?.capabilityPhase ?? input.availability?.state,
    transportPhase: input.availability?.runtimeLifecycle?.transportPhase,
  });
}

function resolveBlockingDependencyCategory(input: {
  readonly availability?: RuntimeCapabilityGuardAvailability;
  readonly runtimeState: RuntimeUnavailableLifecycleResponseContract["state"];
}): RuntimeAvailabilityLifecycleDiagnostics["blockingDependencyCategory"] {
  const transportPhase = input.availability?.runtimeLifecycle?.transportPhase;
  if (transportPhase === "failed" || transportPhase === "unavailable" || transportPhase === "binding") {
    return RuntimeAvailabilityBlockingDependencyCategories.controlPlaneTransport;
  }

  if (input.runtimeState === "unavailable" && normalizeRuntimeState(input.availability?.state) === "pre-login") {
    return RuntimeAvailabilityBlockingDependencyCategories.authentication;
  }
  if (input.runtimeState === "failed") {
    return input.availability?.runtimeLifecycle?.hasFailure
      ? RuntimeAvailabilityBlockingDependencyCategories.runtimeSupervisor
      : RuntimeAvailabilityBlockingDependencyCategories.capabilityActivation;
  }
  if (input.runtimeState === "warming" || input.runtimeState === "unavailable") {
    return RuntimeAvailabilityBlockingDependencyCategories.capabilityActivation;
  }
  return RuntimeAvailabilityBlockingDependencyCategories.unknown;
}

function buildLifecycleSummary(input: {
  readonly runtimeState: RuntimeUnavailableLifecycleResponseContract["state"];
  readonly blockingDependencyCategory: RuntimeAvailabilityLifecycleDiagnostics["blockingDependencyCategory"];
  readonly availability?: RuntimeCapabilityGuardAvailability;
}): string {
  if (input.blockingDependencyCategory === RuntimeAvailabilityBlockingDependencyCategories.controlPlaneTransport) {
    const transportPhase = input.availability?.runtimeLifecycle?.transportPhase ?? "unknown";
    return `Desktop control-plane transport is '${transportPhase}'.`;
  }
  if (input.blockingDependencyCategory === RuntimeAvailabilityBlockingDependencyCategories.authentication) {
    return "An authenticated desktop session is required before deferred runtime activation.";
  }
  if (input.blockingDependencyCategory === RuntimeAvailabilityBlockingDependencyCategories.runtimeSupervisor) {
    return "The runtime supervisor reported a deferred activation failure.";
  }
  if (input.runtimeState === "warming") {
    return "Deferred runtime activation is currently warming.";
  }
  if (input.runtimeState === "failed") {
    return "Deferred runtime activation failed and requires retry.";
  }
  return "Deferred runtime capability is not active yet.";
}

export function evaluateRuntimeCapabilityGuard(
  input: EvaluateRuntimeCapabilityGuardInput,
): RuntimeCapabilityGuardDecision {
  if (!RuntimeGuardedRouteFamilies.has(input.routeFamilyId)) {
    return Object.freeze({
      blocked: false,
    });
  }
  if (input.availability?.available) {
    return Object.freeze({
      blocked: false,
    });
  }

  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const runtime = resolveUnavailableLifecycleResponse({
    checkedAt,
    availability: input.availability ?? Object.freeze({
      routeFamilyId: input.routeFamilyId,
      available: false,
    }),
  });
  return Object.freeze({
    blocked: true,
    runtimeState: runtime.state,
    response: createRuntimeGuardedEndpointUnavailableResponseContract({
      endpoint: input.endpoint,
      requestId: input.requestId,
      blockedAt: checkedAt,
      runtime,
    }),
  });
}
