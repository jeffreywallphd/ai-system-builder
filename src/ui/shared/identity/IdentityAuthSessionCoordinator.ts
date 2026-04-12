import { IdentityAuthApiErrorCodes, type IdentityAuthApiErrorCode } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import type { IdentityAuthService } from "../../services/IdentityAuthService";
import {
  AppInitializationStageIds,
  type AppInitializationProgressUpdate,
} from "../initialization/AppInitializationProgress";
import {
  toPersistedIdentitySession,
  type IdentityAuthPersistedSession,
  type IdentityAuthSessionStore,
} from "./IdentityAuthSessionStore";

export const IdentitySessionBootstrapStatus = Object.freeze({
  authenticated: "authenticated",
  unauthenticated: "unauthenticated",
} as const);

export const IdentitySessionUnauthenticatedReason = Object.freeze({
  missingSession: "missing-session",
  expiredSession: "expired-session",
  invalidSession: "invalid-session",
  validationFailed: "validation-failed",
  contextUnavailable: "context-unavailable",
} as const);

export const IdentitySessionBootstrapErrorCodes = Object.freeze({
  identityContextUnavailable: "identity-context-unavailable",
  identityContextInvalid: "identity-context-invalid",
  transportUnavailable: "transport-unavailable",
  timeout: "timeout",
  cancelled: "cancelled",
} as const);

export interface IdentitySessionBootstrapError {
  readonly code: typeof IdentitySessionBootstrapErrorCodes[keyof typeof IdentitySessionBootstrapErrorCodes];
  readonly message: string;
  readonly retryable: boolean;
}

export type IdentitySessionBootstrapResult =
  | {
    readonly status: typeof IdentitySessionBootstrapStatus.authenticated;
    readonly session: IdentityAuthPersistedSession;
  }
  | {
    readonly status: typeof IdentitySessionBootstrapStatus.unauthenticated;
    readonly reason: typeof IdentitySessionUnauthenticatedReason[keyof typeof IdentitySessionUnauthenticatedReason];
    readonly error?: IdentitySessionBootstrapError;
  };

export interface IdentitySessionBootstrapOptions {
  readonly workspaceId?: string;
  readonly onProgress?: (update: AppInitializationProgressUpdate) => void;
  readonly sessionValidationTimeoutMs?: number;
  readonly actorContextTimeoutMs?: number;
  readonly signal?: AbortSignal;
}

const DefaultActorContextTimeoutMs = 10_000;
const WorkspaceContextProgressNoticeDelaysMs = Object.freeze([1_500, 3_500] as const);
const BootstrapRequestRetryPolicy = Object.freeze({
  maxAttempts: 2,
});
const IdentityActorContextFailureKinds = Object.freeze({
  timeout: "timeout",
  callerCancelled: "caller-cancelled",
  retryExhausted: "retry-exhausted",
  transportFailure: "transport-failure",
  authenticationFailed: "authentication-failed",
  serviceNotReady: "service-not-ready",
  invalidSession: "invalid-session",
  unknown: "unknown",
} as const);

export class IdentityAuthSessionCoordinator {
  private static activeBootstrap:
    | {
      readonly promise: Promise<IdentitySessionBootstrapResult>;
    }
    | undefined;
  private static activeActorContextResolutions = new Map<
    string,
    Promise<Awaited<ReturnType<IdentityAuthService["resolveSessionActorContext"]>>>
  >();

  private readonly now: () => Date;

  public constructor(
    private readonly sessionStore: IdentityAuthSessionStore,
    private readonly authService: Pick<IdentityAuthService, "resolveSessionActorContext">,
    now: () => Date = () => new Date(),
  ) {
    this.now = now;
  }

  public static resetInFlightBootstrapForTests(): void {
    IdentityAuthSessionCoordinator.activeBootstrap = undefined;
    IdentityAuthSessionCoordinator.activeActorContextResolutions.clear();
  }

  public async bootstrap(options?: IdentitySessionBootstrapOptions): Promise<IdentitySessionBootstrapResult> {
    if (IdentityAuthSessionCoordinator.activeBootstrap) {
      return IdentityAuthSessionCoordinator.activeBootstrap.promise;
    }

    const startedAt = Date.now();
    logInitDiagnostic("renderer-session-bootstrap:start", Object.freeze({
      startedAt: new Date(startedAt).toISOString(),
    }));
    const bootstrapPromise = this.resolveActiveSession(options)
      .finally(() => {
        if (IdentityAuthSessionCoordinator.activeBootstrap?.promise === bootstrapPromise) {
          IdentityAuthSessionCoordinator.activeBootstrap = undefined;
        }
      });
    IdentityAuthSessionCoordinator.activeBootstrap = Object.freeze({
      promise: bootstrapPromise,
    });
    try {
      return await bootstrapPromise;
    } finally {
      logInitDiagnostic("renderer-session-bootstrap:end", Object.freeze({
        durationMs: Date.now() - startedAt,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date().toISOString(),
      }));
    }
  }

  public async refreshIfAuthenticated(options?: IdentitySessionBootstrapOptions): Promise<IdentitySessionBootstrapResult> {
    if (!this.sessionStore.hasSession()) {
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.missingSession,
      });
    }
    return this.resolveActiveSession(options);
  }

  private async resolveActiveSession(options?: IdentitySessionBootstrapOptions): Promise<IdentitySessionBootstrapResult> {
    this.publishProgress(options, {
      stageId: AppInitializationStageIds.loadingSavedSession,
    });
    const session = this.sessionStore.getSession();
    if (!session) {
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.readyForSignIn,
        detail: "No previous session was found on this device.",
      });
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.missingSession,
      });
    }

    if (this.sessionStore.isSessionExpired(session, this.now())) {
      this.sessionStore.clearSession();
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.readyForSignIn,
        detail: "Your previous session has expired.",
      });
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.expiredSession,
      });
    }

    try {
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.validatingSession,
      });

      this.publishProgress(options, {
        stageId: AppInitializationStageIds.loadingWorkspaceContext,
        detail: "Requesting workspace context and permissions from the identity service.",
      });
      const actorContext = await this.resolveSessionActorContextWithTiming({
        sessionToken: session.sessionToken,
        workspaceId: normalizeWorkspaceId(options?.workspaceId),
      }, options);
      if (!actorContext.ok || !actorContext.data) {
        if (actorContext.error?.code === IdentityAuthApiErrorCodes.authenticationFailed) {
          this.sessionStore.clearSession();
          this.publishProgress(options, {
            stageId: AppInitializationStageIds.readyForSignIn,
            detail: "Your previous session is no longer valid.",
          });
          return Object.freeze({
            status: IdentitySessionBootstrapStatus.unauthenticated,
            reason: IdentitySessionUnauthenticatedReason.invalidSession,
            error: toBootstrapError(
              actorContext.error?.code,
              actorContext.error?.message ?? "Session is no longer valid.",
              actorContext.error,
            ),
          });
        }

        this.publishProgress(options, {
          stageId: AppInitializationStageIds.readyForSignIn,
          detail: isTimeoutIdentityError(actorContext.error)
            ? "Sign-in check took too long. You can sign in again."
            : isRequestCancelledIdentityError(actorContext.error)
              ? "Sign-in check was interrupted before workspace context finished loading."
              : "Workspace access could not be loaded from the server.",
        });
        return Object.freeze({
          status: IdentitySessionBootstrapStatus.unauthenticated,
          reason: IdentitySessionUnauthenticatedReason.contextUnavailable,
          error: toBootstrapError(
            actorContext.error?.code,
            actorContext.error?.message ?? "Session context could not be loaded.",
            actorContext.error,
          ),
        });
      }

      const hydratedSession = toPersistedIdentitySession({
        userIdentityId: actorContext.data.actor.userIdentityId,
        username: actorContext.data.actor.username,
        displayName: actorContext.data.actor.displayName,
        providerId: actorContext.data.session.providerId,
        sessionId: actorContext.data.session.sessionId,
        sessionToken: session.sessionToken,
        sessionTokenType: session.sessionTokenType,
        sessionIssuedAt: actorContext.data.session.issuedAt,
        sessionExpiresAt: actorContext.data.session.expiresAt,
        sessionAccessChannel: actorContext.data.session.accessChannel,
        sessionAssuranceLevel: actorContext.data.session.assuranceLevel,
        sessionTrustState: actorContext.data.session.trustState,
        sessionTrustedDeviceId: actorContext.data.session.trustedDeviceId,
        sessionTrustEvaluatedAt: actorContext.data.session.trustEvaluatedAt,
        sessionTrustInvalidationReasons: actorContext.data.session.trustInvalidationReasons,
        trustedDeviceDisplayName: actorContext.data.trustedDevice?.displayName,
        workspaceContext: Object.freeze({
          requestedWorkspaceId: actorContext.data.workspaceContext.requestedWorkspaceId,
          resolvedWorkspaceId: actorContext.data.workspaceContext.resolvedWorkspaceId,
          workspaces: Object.freeze([...actorContext.data.workspaceContext.workspaces]),
        }),
        initialCapabilityState: deriveInitialCapabilityState(actorContext.data),
      });
      this.sessionStore.saveSession(hydratedSession);
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.ready,
      });
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.authenticated,
        session: hydratedSession,
      });
    } catch {
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.readyForSignIn,
        detail: "Unable to reach sign-in services right now.",
      });
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.contextUnavailable,
        error: Object.freeze({
          code: IdentitySessionBootstrapErrorCodes.transportUnavailable,
          message: "Unable to reach the identity API while loading session context.",
          retryable: true,
        }),
      });
    }
  }

  private publishProgress(
    options: IdentitySessionBootstrapOptions | undefined,
    update: AppInitializationProgressUpdate,
  ): void {
    options?.onProgress?.(Object.freeze({
      stageId: update.stageId,
      detail: update.detail,
    }));
  }

  private async resolveSessionActorContextWithTiming(
    request: {
      readonly sessionToken: string;
      readonly workspaceId?: string;
    },
    options?: IdentitySessionBootstrapOptions,
  ): Promise<Awaited<ReturnType<IdentityAuthService["resolveSessionActorContext"]>>> {
    const requestKey = buildSessionActorContextRequestKey(request.sessionToken, request.workspaceId);
    const inFlightResolution = IdentityAuthSessionCoordinator.activeActorContextResolutions.get(requestKey);
    if (inFlightResolution) {
      return await inFlightResolution;
    }

    const startedAt = Date.now();
    const timeoutMs = normalizeTimeoutMs(options?.actorContextTimeoutMs, DefaultActorContextTimeoutMs);
    const cancelPendingProgressNotices = this.scheduleWorkspaceContextProgressNotices(
      options,
      startedAt,
      timeoutMs,
      request.workspaceId,
    );
    logInitDiagnostic("resolveSessionActorContext:start", Object.freeze({
      timeoutMs,
      startedAt: new Date(startedAt).toISOString(),
      requestedWorkspaceId: request.workspaceId,
    }));
    const timedResolutionPromise = (async () => {
      const result = await this.authService.resolveSessionActorContext(request, {
        timeoutMs,
        retryPolicy: BootstrapRequestRetryPolicy,
      });
      const failureKind = classifyActorContextFailure(result.error);
      logInitDiagnostic("resolveSessionActorContext:result", Object.freeze({
        ok: result.ok,
        errorCode: result.error?.code,
        errorDomainCode: result.error?.domainCode,
        retryable: result.error?.retryable,
        failureKind,
        resolvedWorkspaceId: result.data?.workspaceContext.resolvedWorkspaceId,
        workspaceCount: result.data?.workspaceContext.workspaces.length,
        durationMs: Date.now() - startedAt,
      }));
      if (failureKind === IdentityActorContextFailureKinds.unknown && result.error) {
        logUnknownActorContextFailure(result.error);
      }
      return result;
    })();

    IdentityAuthSessionCoordinator.activeActorContextResolutions.set(requestKey, timedResolutionPromise);
    try {
      const waitResult = await waitForResolutionUnlessCallerCancelled(timedResolutionPromise, options?.signal);
      if (waitResult.kind === "caller-cancelled") {
        logInitDiagnostic("resolveSessionActorContext:result", Object.freeze({
          ok: false,
          errorCode: IdentityAuthApiErrorCodes.internal,
          errorDomainCode: "caller-cancelled",
          retryable: true,
          failureKind: IdentityActorContextFailureKinds.callerCancelled,
          durationMs: Date.now() - startedAt,
        }));
        return buildCallerCancelledResponse();
      }
      return waitResult.result;
    } finally {
      IdentityAuthSessionCoordinator.activeActorContextResolutions.delete(requestKey);
      cancelPendingProgressNotices();
      logInitDiagnostic("resolveSessionActorContext:end", Object.freeze({
        durationMs: Date.now() - startedAt,
        endedAt: new Date().toISOString(),
      }));
    }
  }

  private scheduleWorkspaceContextProgressNotices(
    options: IdentitySessionBootstrapOptions | undefined,
    startedAt: number,
    timeoutMs: number,
    workspaceId?: string,
  ): () => void {
    if (!options?.onProgress) {
      return () => {
        // no-op
      };
    }
    const timers = WorkspaceContextProgressNoticeDelaysMs.map((delayMs) => setTimeout(() => {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, timeoutMs - elapsedMs);
      const workspaceClause = workspaceId ? ` for workspace ${workspaceId}` : "";
      const detail = delayMs === WorkspaceContextProgressNoticeDelaysMs[0]
        ? `Still waiting on identity service response${workspaceClause}; server startup can add a short delay. (${elapsedMs} ms elapsed)`
        : `Identity service is still resolving workspace context${workspaceClause}. (${elapsedMs} ms elapsed, ~${remainingMs} ms before timeout)`;
      this.publishProgress(options, {
        stageId: AppInitializationStageIds.loadingWorkspaceContext,
        detail,
      });
      logInitDiagnostic("resolveSessionActorContext:progress", Object.freeze({
        elapsedMs,
        remainingMs,
        requestedWorkspaceId: workspaceId,
      }));
    }, delayMs));
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }
}

function logInitDiagnostic(event: string, details?: Readonly<Record<string, unknown>>): void {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.info(`\n[ai-loom][init] ${event}${payload}\n`);
}

function logUnknownActorContextFailure(error: unknown): void {
  const stackTrace = extractStackTraceForDiagnostics(error);
  console.error(
    `%c[ai-loom][init] resolveSessionActorContext:unknown-failure\n${stackTrace}`,
    "color: #ff4d4f; font-weight: 700;",
  );
}

function normalizeWorkspaceId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function buildSessionActorContextRequestKey(sessionToken: string, workspaceId?: string): string {
  return `${sessionToken}::${workspaceId ?? "*"}`;
}

function deriveInitialCapabilityState(
  actorContext: NonNullable<Awaited<ReturnType<IdentityAuthService["resolveSessionActorContext"]>>["data"]>,
): IdentityAuthPersistedSession["initialCapabilityState"] {
  const resolvedWorkspaceId = actorContext.workspaceContext.resolvedWorkspaceId;
  const resolvedWorkspace = resolvedWorkspaceId
    ? actorContext.workspaceContext.workspaces.find((workspace) => workspace.workspaceId === resolvedWorkspaceId)
    : undefined;

  if (!resolvedWorkspace) {
    return Object.freeze({
      workspaceId: resolvedWorkspaceId,
      effectiveRoles: Object.freeze([]),
      canAdministrate: false,
      isWorkspaceOwner: false,
    });
  }

  return Object.freeze({
    workspaceId: resolvedWorkspace.workspaceId,
    effectiveRoles: Object.freeze([...resolvedWorkspace.effectiveRoles]),
    canAdministrate: resolvedWorkspace.canAdministrate,
    isWorkspaceOwner: resolvedWorkspace.isWorkspaceOwner,
  });
}

function toBootstrapError(
  errorCode: IdentityAuthApiErrorCode | undefined,
  message: string,
  error?: unknown,
): IdentitySessionBootstrapError {
  if (isRequestCancelledIdentityError(error)) {
    return Object.freeze({
      code: IdentitySessionBootstrapErrorCodes.cancelled,
      message,
      retryable: true,
    });
  }
  if (errorCode === IdentityAuthApiErrorCodes.authenticationFailed) {
    return Object.freeze({
      code: IdentitySessionBootstrapErrorCodes.identityContextInvalid,
      message,
      retryable: false,
    });
  }
  if (isTimeoutIdentityError(error)) {
    return Object.freeze({
      code: IdentitySessionBootstrapErrorCodes.timeout,
      message,
      retryable: true,
    });
  }

  return Object.freeze({
    code: IdentitySessionBootstrapErrorCodes.identityContextUnavailable,
    message,
    retryable: errorCode === IdentityAuthApiErrorCodes.internal,
  });
}

function normalizeTimeoutMs(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function isTimeoutIdentityError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const domainCode = readOptionalString(error, "domainCode");
  if (domainCode === "request-timeout") {
    return true;
  }
  const message = readOptionalString(error, "message");
  return Boolean(message && /timed?\s*out/i.test(message));
}

function isRequestCancelledIdentityError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const domainCode = readOptionalString(error, "domainCode");
  return domainCode === "request-cancelled" || domainCode === "caller-cancelled";
}

function classifyActorContextFailure(error: unknown): string {
  if (!isRecord(error)) {
    return IdentityActorContextFailureKinds.unknown;
  }
  const code = readOptionalString(error, "code");
  const domainCode = readOptionalString(error, "domainCode");
  if (domainCode === "request-timeout") {
    return IdentityActorContextFailureKinds.timeout;
  }
  if (domainCode === "request-cancelled" || domainCode === "caller-cancelled") {
    return IdentityActorContextFailureKinds.callerCancelled;
  }
  if (domainCode === "retry-attempts-exhausted") {
    return IdentityActorContextFailureKinds.retryExhausted;
  }
  if (domainCode === "transport-unavailable") {
    return IdentityActorContextFailureKinds.transportFailure;
  }
  if (domainCode === "service-not-ready") {
    return IdentityActorContextFailureKinds.serviceNotReady;
  }
  if (code === IdentityAuthApiErrorCodes.authenticationFailed) {
    return IdentityActorContextFailureKinds.authenticationFailed;
  }
  if (code === IdentityAuthApiErrorCodes.notFound || code === IdentityAuthApiErrorCodes.forbidden) {
    return IdentityActorContextFailureKinds.invalidSession;
  }
  return IdentityActorContextFailureKinds.unknown;
}

function buildCallerCancelledResponse(): Awaited<ReturnType<IdentityAuthService["resolveSessionActorContext"]>> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: IdentityAuthApiErrorCodes.internal,
      message: "Session context request was cancelled by the caller.",
      retryable: true,
      domainCode: "caller-cancelled",
    }),
  });
}

async function waitForResolutionUnlessCallerCancelled<T>(
  resolution: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<{ readonly kind: "resolved"; readonly result: T } | { readonly kind: "caller-cancelled" }> {
  if (!signal) {
    return Object.freeze({
      kind: "resolved",
      result: await resolution,
    });
  }
  if (signal.aborted) {
    return Object.freeze({
      kind: "caller-cancelled",
    });
  }
  const cancellationPromise = new Promise<{ readonly kind: "caller-cancelled" }>((resolve) => {
    signal.addEventListener("abort", () => {
      resolve(Object.freeze({
        kind: "caller-cancelled",
      }));
    }, { once: true });
  });
  const resolved = await Promise.race([
    resolution.then((result) => Object.freeze({
      kind: "resolved" as const,
      result,
    })),
    cancellationPromise,
  ]);
  return resolved;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function extractStackTraceForDiagnostics(error: unknown): string {
  if (error instanceof Error && typeof error.stack === "string" && error.stack.trim().length > 0) {
    return error.stack;
  }
  if (isRecord(error)) {
    const stack = readOptionalString(error, "stack");
    if (typeof stack === "string" && stack.trim().length > 0) {
      return stack;
    }
    const nestedCause = (error as { cause?: unknown }).cause;
    if (nestedCause instanceof Error && typeof nestedCause.stack === "string" && nestedCause.stack.trim().length > 0) {
      return nestedCause.stack;
    }
    return JSON.stringify(error, null, 2);
  }
  return String(error);
}
