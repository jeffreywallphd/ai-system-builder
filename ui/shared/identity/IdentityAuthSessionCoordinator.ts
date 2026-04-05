import { IdentityAuthApiErrorCodes, type LoginLocalIdentityApiResponse } from "../../../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import type { IdentityAuthService } from "../../services/IdentityAuthService";
import type { IdentityAuthSessionStore } from "./IdentityAuthSessionStore";

export const IdentitySessionBootstrapStatus = Object.freeze({
  authenticated: "authenticated",
  unauthenticated: "unauthenticated",
} as const);

export const IdentitySessionUnauthenticatedReason = Object.freeze({
  missingSession: "missing-session",
  expiredSession: "expired-session",
  invalidSession: "invalid-session",
  validationFailed: "validation-failed",
} as const);

export type IdentitySessionBootstrapResult =
  | {
    readonly status: typeof IdentitySessionBootstrapStatus.authenticated;
    readonly session: LoginLocalIdentityApiResponse;
  }
  | {
    readonly status: typeof IdentitySessionBootstrapStatus.unauthenticated;
    readonly reason: typeof IdentitySessionUnauthenticatedReason[keyof typeof IdentitySessionUnauthenticatedReason];
  };

export class IdentityAuthSessionCoordinator {
  private readonly now: () => Date;

  public constructor(
    private readonly sessionStore: IdentityAuthSessionStore,
    private readonly authService: Pick<IdentityAuthService, "resolveAuthenticatedSession">,
    now: () => Date = () => new Date(),
  ) {
    this.now = now;
  }

  public async bootstrap(): Promise<IdentitySessionBootstrapResult> {
    return this.resolveActiveSession();
  }

  public async refreshIfAuthenticated(): Promise<IdentitySessionBootstrapResult> {
    if (!this.sessionStore.hasSession()) {
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.missingSession,
      });
    }
    return this.resolveActiveSession();
  }

  private async resolveActiveSession(): Promise<IdentitySessionBootstrapResult> {
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
      const response = await this.authService.resolveAuthenticatedSession({
        sessionToken: session.sessionToken,
      });
      if (!response.ok || !response.data) {
        this.sessionStore.clearSession();
        return Object.freeze({
          status: IdentitySessionBootstrapStatus.unauthenticated,
          reason: response.error?.code === IdentityAuthApiErrorCodes.authenticationFailed
            ? IdentitySessionUnauthenticatedReason.invalidSession
            : IdentitySessionUnauthenticatedReason.validationFailed,
        });
      }

      const hydratedSession = Object.freeze({
        ...session,
        userIdentityId: response.data.principal.userIdentityId,
        username: response.data.principal.username,
        email: response.data.principal.email,
        displayName: response.data.principal.displayName,
        providerId: response.data.session.providerId,
        providerSubject: response.data.session.providerSubject,
        sessionId: response.data.session.sessionId,
        sessionIssuedAt: response.data.session.issuedAt,
        sessionExpiresAt: response.data.session.expiresAt,
        sessionAccessChannel: response.data.session.accessChannel,
        sessionDeviceId: response.data.session.deviceId,
        sessionTrustedDeviceBindingId: response.data.session.trustedDeviceBindingId,
        sessionTrustMarker: response.data.session.trustMarker,
      });
      this.sessionStore.saveSession(hydratedSession);
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.authenticated,
        session: hydratedSession,
      });
    } catch {
      this.sessionStore.clearSession();
      return Object.freeze({
        status: IdentitySessionBootstrapStatus.unauthenticated,
        reason: IdentitySessionUnauthenticatedReason.validationFailed,
      });
    }
  }
}
