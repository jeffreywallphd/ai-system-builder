import { useEffect, useMemo, useState } from "react";
import AppRouter from "./routes/AppRouter";
import { AppProviders } from "./composition/AppProviders";
import { AppRuntimeConfig } from "../infrastructure/config/AppRuntimeConfig";
import type { LoginLocalIdentityApiResponse } from "../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { IdentitySessionUnauthenticatedReason, IdentitySessionBootstrapStatus, IdentityAuthSessionCoordinator } from "./shared/identity/IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "./shared/identity/IdentityAuthSessionStore";
import { IdentityAuthService } from "./services/IdentityAuthService";

export interface AppProps {
  readonly isAuthenticated?: boolean;
  readonly config?: AppRuntimeConfig;
}

export default function App({
  isAuthenticated,
  config,
}: AppProps): JSX.Element {
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const authService = useMemo(() => new IdentityAuthService(), []);
  const sessionCoordinator = useMemo(
    () => new IdentityAuthSessionCoordinator(sessionStore, authService),
    [authService, sessionStore],
  );
  const [authNotice, setAuthNotice] = useState<"session-expired" | "session-invalid" | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof isAuthenticated === "boolean") {
      return isAuthenticated;
    }
    return false;
  });
  const [isAuthBootstrapPending, setIsAuthBootstrapPending] = useState<boolean>(() => {
    if (typeof isAuthenticated === "boolean") {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (typeof isAuthenticated === "boolean") {
      setAuthenticated(isAuthenticated);
      setIsAuthBootstrapPending(false);
      setAuthNotice(undefined);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof isAuthenticated === "boolean") {
      return;
    }

    let cancelled = false;

    const resolveInitialSession = async () => {
      const result = await sessionCoordinator.bootstrap();
      if (cancelled) {
        return;
      }

      if (result.status === IdentitySessionBootstrapStatus.authenticated) {
        setAuthenticated(true);
        setAuthNotice(undefined);
      } else {
        setAuthenticated(false);
        if (result.reason === IdentitySessionUnauthenticatedReason.expiredSession) {
          setAuthNotice("session-expired");
        } else if (result.reason === IdentitySessionUnauthenticatedReason.invalidSession) {
          setAuthNotice("session-invalid");
        } else {
          setAuthNotice(undefined);
        }
      }
      setIsAuthBootstrapPending(false);
    };

    void resolveInitialSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (!sessionStore.hasSession()) {
        return;
      }

      void sessionCoordinator.refreshIfAuthenticated().then((result) => {
        if (cancelled) {
          return;
        }

        if (result.status === IdentitySessionBootstrapStatus.authenticated) {
          setAuthenticated(true);
          setAuthNotice(undefined);
          return;
        }

        setAuthenticated(false);
        if (result.reason === IdentitySessionUnauthenticatedReason.expiredSession) {
          setAuthNotice("session-expired");
        } else if (result.reason === IdentitySessionUnauthenticatedReason.invalidSession) {
          setAuthNotice("session-invalid");
        } else {
          setAuthNotice(undefined);
        }
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, sessionCoordinator, sessionStore]);

  const handleAuthenticated = (session: LoginLocalIdentityApiResponse) => {
    sessionStore.saveSession(session);
    setAuthenticated(true);
    setAuthNotice(undefined);
  };

  const handleLogout = async (): Promise<void> => {
    const session = sessionStore.getSession();
    if (session?.sessionToken) {
      try {
        await authService.logoutAuthenticatedSession({
          sessionToken: session.sessionToken,
        });
      } catch {
        // Local session cleanup still proceeds to prevent stale authenticated UI state.
      }
    }
    sessionStore.clearSession();
    setAuthenticated(false);
    setAuthNotice(undefined);
  };

  const router = (
    <AppRouter
      isAuthenticated={authenticated}
      authNotice={authNotice}
      onAuthenticated={handleAuthenticated}
      onLogout={handleLogout}
    />
  );

  if (isAuthBootstrapPending) {
    return (
      <section className="ui-page ui-auth-page">
        <div className="ui-auth-card ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Checking session</h1>
            <p className="ui-card__subtitle">Validating your authenticated session with AI Loom identity.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!authenticated) {
    return router;
  }

  return (
    <AppProviders config={config}>
      {router}
    </AppProviders>
  );
}
