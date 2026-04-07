import { useEffect, useMemo, useState } from "react";
import AppRouter from "./routes/AppRouter";
import { AppProviders } from "./composition/AppProviders";
import { AppRuntimeConfig } from "@infrastructure/config/AppRuntimeConfig";
import type { LoginLocalIdentityApiResponse } from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { IdentitySessionUnauthenticatedReason, IdentitySessionBootstrapStatus, IdentityAuthSessionCoordinator } from "./shared/identity/IdentityAuthSessionCoordinator";
import { IdentityAuthSessionStore } from "./shared/identity/IdentityAuthSessionStore";
import { IdentityAuthService } from "./services/IdentityAuthService";
import {
  AppInitializationStageIds,
  AppInitializationStageOrder,
  getAppInitializationStagePresentation,
  type AppInitializationProgressUpdate,
} from "./shared/initialization/AppInitializationProgress";

type AppAuthNotice = "session-expired" | "session-invalid" | "session-context-unavailable" | "session-bootstrap-timeout";

const StillWorkingThresholdMs = 6_000;

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
  const [authNotice, setAuthNotice] = useState<AppAuthNotice | undefined>(undefined);
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    if (typeof isAuthenticated === "boolean") {
      return isAuthenticated;
    }
    return false;
  });
  const [initializationProgress, setInitializationProgress] = useState<Readonly<AppInitializationProgressUpdate>>(() => {
    if (typeof window !== "undefined" && window.aiLoomDesktop?.bootstrap) {
      return Object.freeze({ stageId: AppInitializationStageIds.startingIdentityServices });
    }
    return Object.freeze({ stageId: AppInitializationStageIds.loadingSavedSession });
  });
  const [initializationProgressUpdatedAt, setInitializationProgressUpdatedAt] = useState<number>(() => Date.now());
  const [isInitializationStillWorking, setIsInitializationStillWorking] = useState<boolean>(false);
  const [isAuthBootstrapPending, setIsAuthBootstrapPending] = useState<boolean>(() => {
    if (typeof isAuthenticated === "boolean") {
      return false;
    }
    return sessionStore.hasSession();
  });

  useEffect(() => {
    if (typeof isAuthenticated === "boolean") {
      setAuthenticated(isAuthenticated);
      setIsAuthBootstrapPending(false);
      setAuthNotice(undefined);
      setInitializationProgress(Object.freeze({
        stageId: isAuthenticated ? AppInitializationStageIds.ready : AppInitializationStageIds.readyForSignIn,
      }));
      setInitializationProgressUpdatedAt(Date.now());
      setIsInitializationStillWorking(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthBootstrapPending) {
      setIsInitializationStillWorking(false);
      return;
    }
    const timer = setInterval(() => {
      setIsInitializationStillWorking(Date.now() - initializationProgressUpdatedAt >= StillWorkingThresholdMs);
    }, 350);
    return () => {
      clearInterval(timer);
    };
  }, [isAuthBootstrapPending, initializationProgressUpdatedAt]);

  useEffect(() => {
    if (typeof isAuthenticated === "boolean") {
      return;
    }

    let cancelled = false;

    const publishInitializationProgress = (progress: AppInitializationProgressUpdate): void => {
      if (cancelled) {
        return;
      }
      setInitializationProgress(progress);
      setInitializationProgressUpdatedAt(Date.now());
      setIsInitializationStillWorking(false);
    };

    if (!sessionStore.hasSession()) {
      publishInitializationProgress({
        stageId: AppInitializationStageIds.readyForSignIn,
        detail: "No saved sign-in was found on this device.",
      });
      setIsAuthBootstrapPending(false);
      return () => {
        cancelled = true;
      };
    }

    const resolveInitialSession = async () => {
      const result = await sessionCoordinator.bootstrap({
        onProgress: publishInitializationProgress,
      });
      if (cancelled) {
        return;
      }

      if (result.status === IdentitySessionBootstrapStatus.authenticated) {
        setAuthenticated(true);
        setAuthNotice(undefined);
        publishInitializationProgress({
          stageId: AppInitializationStageIds.ready,
        });
      } else {
        setAuthenticated(false);
        if (result.reason === IdentitySessionUnauthenticatedReason.expiredSession) {
          setAuthNotice("session-expired");
        } else if (result.reason === IdentitySessionUnauthenticatedReason.invalidSession) {
          setAuthNotice("session-invalid");
        } else if (result.reason === IdentitySessionUnauthenticatedReason.contextUnavailable) {
          setAuthNotice(result.error?.code === "timeout" ? "session-bootstrap-timeout" : "session-context-unavailable");
        } else {
          setAuthNotice(undefined);
        }
        publishInitializationProgress({
          stageId: AppInitializationStageIds.readyForSignIn,
          detail: result.reason === IdentitySessionUnauthenticatedReason.missingSession
            ? "No saved sign-in was found on this device."
            : result.error?.message,
        });
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
        } else if (result.reason === IdentitySessionUnauthenticatedReason.contextUnavailable) {
          setAuthNotice(result.error?.code === "timeout" ? "session-bootstrap-timeout" : "session-context-unavailable");
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

  const handleAuthenticated = async (session: LoginLocalIdentityApiResponse): Promise<boolean> => {
    sessionStore.saveSession(session);
    const result = await sessionCoordinator.refreshIfAuthenticated();
    if (result.status === IdentitySessionBootstrapStatus.authenticated) {
      setAuthenticated(true);
      setAuthNotice(undefined);
      return true;
    }

    setAuthenticated(false);
    if (result.reason === IdentitySessionUnauthenticatedReason.expiredSession) {
      setAuthNotice("session-expired");
    } else if (result.reason === IdentitySessionUnauthenticatedReason.invalidSession) {
      setAuthNotice("session-invalid");
    } else if (result.reason === IdentitySessionUnauthenticatedReason.contextUnavailable) {
      setAuthNotice(result.error?.code === "timeout" ? "session-bootstrap-timeout" : "session-context-unavailable");
    } else {
      setAuthNotice(undefined);
    }
    return false;
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
    setInitializationProgress(Object.freeze({ stageId: AppInitializationStageIds.readyForSignIn }));
    setInitializationProgressUpdatedAt(Date.now());
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
    const stagePresentation = getAppInitializationStagePresentation(initializationProgress.stageId);
    const currentStageIndex = AppInitializationStageOrder.indexOf(initializationProgress.stageId);
    return (
      <section className="ui-page ui-auth-page">
        <div className="ui-auth-card ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">{stagePresentation.title}</h1>
            <p className="ui-card__subtitle">{stagePresentation.subtitle}</p>
            {initializationProgress.detail ? (
              <p className="ui-auth-page__progress-detail" role="status" aria-live="polite">{initializationProgress.detail}</p>
            ) : null}
            {isInitializationStillWorking ? (
              <p className="ui-auth-page__progress-still-working" role="status" aria-live="polite">Still working on setup...</p>
            ) : null}
          </div>
          <ol className="ui-auth-page__progress-steps" aria-label="Initialization progress">
            {AppInitializationStageOrder.slice(0, 7).map((stageId, index) => {
              const stage = getAppInitializationStagePresentation(stageId);
              const isCurrent = stageId === initializationProgress.stageId;
              const isComplete = index < currentStageIndex;
              const className = isCurrent
                ? "ui-auth-page__progress-step ui-auth-page__progress-step--current"
                : isComplete
                  ? "ui-auth-page__progress-step ui-auth-page__progress-step--complete"
                  : "ui-auth-page__progress-step";
              return (
                <li key={stageId} className={className}>
                  {stage.title}
                </li>
              );
            })}
          </ol>
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
