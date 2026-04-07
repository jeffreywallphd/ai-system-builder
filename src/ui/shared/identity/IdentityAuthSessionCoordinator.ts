import { IdentityAuthApiErrorCodes, type IdentityAuthApiErrorCode } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import type { IdentityAuthService } from "../../services/IdentityAuthService";
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
}

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
    return this.resolveActiveSession(options);
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
    const session = this.sessionStore.getSession();
    if (!session) {
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.missingSession,
      });
    }

    if (this.sessionStore.isSessionExpired(session, this.now())) {
      this.sessionStore.clearSession();
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.expiredSession,
      });
    }

    try {
      const resolvedSession = await this.authService.resolveAuthenticatedSession({
        sessionToken: session.sessionToken,
      });
      if (!resolvedSession.ok || !resolvedSession.data) {
        this.sessionStore.clearSession();
        return Object.freeze({
          status: IdentitySessionBootstrapStatus.unauthenticated,
          reason: resolvedSession.error?.code === IdentityAuthApiErrorCodes.authenticationFailed
            ? IdentitySessionUnauthenticatedReason.invalidSession
            : IdentitySessionUnauthenticatedReason.validationFailed,
          error: toBootstrapError(
            resolvedSession.error?.code,
            resolvedSession.error?.message ?? "Session validation failed.",
          ),
        });
      }

      const actorContext = await this.authService.resolveSessionActorContext({
        sessionToken: session.sessionToken,
        workspaceId: normalizeWorkspaceId(options?.workspaceId),
      });
      if (!actorContext.ok || !actorContext.data) {
        if (actorContext.error?.code === IdentityAuthApiErrorCodes.authenticationFailed) {
          this.sessionStore.clearSession();
          return Object.freeze({
            status: IdentitySessionBootstrapStatus.unauthenticated,
            reason: IdentitySessionUnauthenticatedReason.invalidSession,
            error: toBootstrapError(
              actorContext.error?.code,
              actorContext.error?.message ?? "Session is no longer valid.",
            ),
          });
        }

        return Object.freeze({
          status: IdentitySessionBootstrapStatus.unauthenticated,
          reason: IdentitySessionUnauthenticatedReason.contextUnavailable,
          error: toBootstrapError(
            actorContext.error?.code,
            actorContext.error?.message ?? "Session context could not be loaded.",
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
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.authenticated,
        session: hydratedSession,
      });
    } catch {
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
  code: IdentityAuthApiErrorCode | undefined,
  message: string,
): IdentitySessionBootstrapError {
  if (code === IdentityAuthApiErrorCodes.authenticationFailed) {
    return Object.freeze({
      code: IdentitySessionBootstrapErrorCodes.identityContextInvalid,
      message,
      retryable: false,
    });
  }

  return Object.freeze({
    code: IdentitySessionBootstrapErrorCodes.identityContextUnavailable,
    message,
    retryable: code === IdentityAuthApiErrorCodes.internal,
  });
}
