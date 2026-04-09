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
}

const DefaultSessionValidationTimeoutMs = 4_000;
const DefaultActorContextTimeoutMs = 5_000;
const WorkspaceContextProgressNoticeDelaysMs = Object.freeze([1_500, 3_500] as const);
const BootstrapRequestRetryPolicy = Object.freeze({
  maxAttempts: 1,
});

export class IdentityAuthSessionCoordinator {
  private readonly now: () => Date;

  public constructor(
    private readonly sessionStore: IdentityAuthSessionStore,
    private readonly authService: Pick<IdentityAuthService, "resolveAuthenticatedSession" | "resolveSessionActorContext">,
    now: () => Date = () => new Date(),
  ) {
    this.now = now;
  }

  public async bootstrap(options?: IdentitySessionBootstrapOptions): Promise<IdentitySessionBootstrapResult> {
    const startedAt = Date.now();
    logInitDiagnostic("renderer-session-bootstrap:start", Object.freeze({
      startedAt: new Date(startedAt).toISOString(),
    }));
    try {
      return await this.resolveActiveSession(options);
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

      const resolvedSession = await this.resolveAuthenticatedSessionWithTiming({
        sessionToken: session.sessionToken,
      }, options);
      if (!resolvedSession.ok || !resolvedSession.data) {
        this.sessionStore.clearSession();
        this.publishProgress(options, {
          stageId: AppInitializationStageIds.readyForSignIn,
          detail: resolvedSession.error?.code === IdentityAuthApiErrorCodes.authenticationFailed
            ? "Your previous session is no longer valid."
            : "Previous session could not be verified.",
        });
        return Object.freeze({
          status: IdentitySessionBootstrapStatus.unauthenticated,
          reason: resolvedSession.error?.code === IdentityAuthApiErrorCodes.authenticationFailed
            ? IdentitySessionUnauthenticatedReason.invalidSession
            : IdentitySessionUnauthenticatedReason.validationFailed,
          error: toBootstrapError(
            resolvedSession.error?.code,
            resolvedSession.error?.message ?? "Session validation failed.",
            resolvedSession.error,
          ),
        });
      }

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

  private async resolveAuthenticatedSessionWithTiming(
    request: { readonly sessionToken: string },
    options?: IdentitySessionBootstrapOptions,
  ): Promise<Awaited<ReturnType<IdentityAuthService["resolveAuthenticatedSession"]>>> {
    const startedAt = Date.now();
    const timeoutMs = normalizeTimeoutMs(options?.sessionValidationTimeoutMs, DefaultSessionValidationTimeoutMs);
    logInitDiagnostic("resolveAuthenticatedSession:start", Object.freeze({
      timeoutMs,
      startedAt: new Date(startedAt).toISOString(),
    }));
    try {
      const result = await this.authService.resolveAuthenticatedSession(request, {
        timeoutMs,
        retryPolicy: BootstrapRequestRetryPolicy,
      });
      logInitDiagnostic("resolveAuthenticatedSession:result", Object.freeze({
        ok: result.ok,
        errorCode: result.error?.code,
        durationMs: Date.now() - startedAt,
      }));
      return result;
    } finally {
      logInitDiagnostic("resolveAuthenticatedSession:end", Object.freeze({
        durationMs: Date.now() - startedAt,
        endedAt: new Date().toISOString(),
      }));
    }
  }

  private async resolveSessionActorContextWithTiming(
    request: {
      readonly sessionToken: string;
      readonly workspaceId?: string;
    },
    options?: IdentitySessionBootstrapOptions,
  ): Promise<Awaited<ReturnType<IdentityAuthService["resolveSessionActorContext"]>>> {
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
    try {
      const result = await this.authService.resolveSessionActorContext(request, {
        timeoutMs,
        retryPolicy: BootstrapRequestRetryPolicy,
      });
      logInitDiagnostic("resolveSessionActorContext:result", Object.freeze({
        ok: result.ok,
        errorCode: result.error?.code,
        resolvedWorkspaceId: result.data?.workspaceContext.resolvedWorkspaceId,
        workspaceCount: result.data?.workspaceContext.workspaces.length,
        durationMs: Date.now() - startedAt,
      }));
      return result;
    } finally {
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

function normalizeWorkspaceId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}
