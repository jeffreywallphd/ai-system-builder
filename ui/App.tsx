import { useEffect, useMemo, useState } from "react";
import AppRouter from "./routes/AppRouter";
import { AppProviders } from "./composition/AppProviders";
import { AppRuntimeConfig } from "../infrastructure/config/AppRuntimeConfig";
import type { LoginLocalIdentityApiResponse } from "../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
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
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof isAuthenticated === "boolean") {
      return isAuthenticated;
    }
    return sessionStore.hasSession();
  });

  useEffect(() => {
    if (typeof isAuthenticated === "boolean") {
      setAuthenticated(isAuthenticated);
    }
  }, [isAuthenticated]);

  const handleAuthenticated = (session: LoginLocalIdentityApiResponse) => {
    sessionStore.saveSession(session);
    setAuthenticated(true);
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
  };

  const router = (
    <AppRouter
      isAuthenticated={authenticated}
      onAuthenticated={handleAuthenticated}
      onLogout={handleLogout}
    />
  );

  if (!authenticated) {
    return router;
  }

  return (
    <AppProviders config={config}>
      {router}
    </AppProviders>
  );
}
