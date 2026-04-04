import { useEffect, useMemo, useState } from "react";
import AppRouter from "./routes/AppRouter";
import { AppProviders } from "./composition/AppProviders";
import { AppRuntimeConfig } from "../infrastructure/config/AppRuntimeConfig";
import type { LoginLocalIdentityApiResponse } from "../infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { IdentityAuthSessionStore } from "./shared/identity/IdentityAuthSessionStore";

export interface AppProps {
  readonly isAuthenticated?: boolean;
  readonly config?: AppRuntimeConfig;
}

export default function App({
  isAuthenticated,
  config,
}: AppProps): JSX.Element {
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
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

  const router = (
    <AppRouter
      isAuthenticated={authenticated}
      onAuthenticated={handleAuthenticated}
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
