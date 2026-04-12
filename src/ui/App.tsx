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
import {
  DesktopPostLoginWarmupTriggerSources,
  requestDesktopPostLoginWarmup,
} from "./runtime/DesktopPostLoginWarmup";

type AppAuthNotice = "session-expired" | "session-invalid" | "session-context-unavailable" | "session-bootstrap-timeout";

const StillWorkingThresholdMs = 6_000;
const InitializationProgressLogMaxEntries = 40;

interface InitializationProgressLogEntry extends AppInitializationProgressUpdate {
  readonly occurredAt: number;
}

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
    if (typeof window !== "undefined" && (window.aiLoomDesktop?.auth?.bootstrap ?? window.aiLoomDesktop?.bootstrap)) {
      return Object.freeze({ stageId: AppInitializationStageIds.startingIdentityServices });
    }
    return Object.freeze({ stageId: AppInitializationStageIds.loadingSavedSession });
  });
  const [initializationProgressLog, setInitializationProgressLog] = useState<ReadonlyArray<InitializationProgressLogEntry>>(() => []);
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
      if (isAuthenticated) {
        void requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.unknown);
      }
      setInitializationProgress(Object.freeze({
        stageId: isAuthenticated ? AppInitializationStageIds.ready : AppInitializationStageIds.readyForSignIn,
      }));
      setInitializationProgressLog((current) => appendInitializationProgressLog(
        current,
        Object.freeze({
          stageId: isAuthenticated ? AppInitializationStageIds.ready : AppInitializationStageIds.readyForSignIn,
          occurredAt: Date.now(),
        }),
      ));
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
      const timestamp = Date.now();
      setInitializationProgress(progress);
      setInitializationProgressLog((current) => appendInitializationProgressLog(
        current,
        Object.freeze({
          stageId: progress.stageId,
          detail: progress.detail,
          occurredAt: timestamp,
        }),
      ));
      setInitializationProgressUpdatedAt(timestamp);
      setIsInitializationStillWorking(false);
    };

    if (!sessionStore.hasSession()) {
      publishInitializationProgress({
        stageId: AppInitializationStageIds.readyForSignIn,
        detail: "No previous session was found on this device.",
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
        void requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRestore);
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
            ? "No previous session was found on this device."
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

      void sessionCoordinator.refreshIfAuthenticated({
      }).then((result) => {
        if (cancelled) {
          return;
        }

        if (result.status === IdentitySessionBootstrapStatus.authenticated) {
          setAuthenticated(true);
          setAuthNotice(undefined);
          void requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.sessionRefresh);
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
      void requestDesktopPostLoginWarmup(DesktopPostLoginWarmupTriggerSources.explicitLogin);
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
    const terminalEntries = initializationProgressLog.map((entry, index) => {
      const stage = getAppInitializationStagePresentation(entry.stageId);
      const stageIndex = AppInitializationStageOrder.indexOf(entry.stageId);
      const status = stageIndex < currentStageIndex
        ? "complete"
        : entry.stageId === initializationProgress.stageId
          ? "current"
          : "pending";
      return Object.freeze({
        id: `${entry.stageId}-${entry.occurredAt}-${index}`,
        timestamp: new Date(entry.occurredAt).toLocaleTimeString([], { hour12: false }),
        message: entry.detail ?? stage.subtitle,
        status,
      });
    });
    return (
      <section className="ui-page ui-auth-page">
        <div className="ui-auth-card ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">{stagePresentation.title}</h1>
            <p className="ui-card__subtitle">{stagePresentation.subtitle}</p>
          </div>
          <div className="ui-auth-page__progress-layout">
            <div>
              {initializationProgress.detail ? (
                <p className="ui-auth-page__progress-detail" role="status" aria-live="polite">{initializationProgress.detail}</p>
              ) : null}
              {isInitializationStillWorking ? (
                <p className="ui-auth-page__progress-still-working" role="status" aria-live="polite">Still working on setup...</p>
              ) : null}
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
            <aside className="ui-auth-page__progress-terminal" aria-live="polite" aria-label="Initialization activity log">
              <p className="ui-auth-page__progress-terminal-title">$ startup-log</p>
              <ul className="ui-auth-page__progress-terminal-lines">
                {terminalEntries.map((entry) => (
                  <li key={entry.id} className={`ui-auth-page__progress-terminal-line ui-auth-page__progress-terminal-line--${entry.status}`}>
                    <span className="ui-auth-page__progress-terminal-time">[{entry.timestamp}]</span>
                    <span className="ui-auth-page__progress-terminal-message">{entry.message}</span>
                  </li>
                ))}
              </ul>
            </aside>
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

function appendInitializationProgressLog(
  current: ReadonlyArray<InitializationProgressLogEntry>,
  entry: InitializationProgressLogEntry,
): ReadonlyArray<InitializationProgressLogEntry> {
  const previous = current[current.length - 1];
  if (previous && previous.stageId === entry.stageId && previous.detail === entry.detail) {
    return current;
  }
  const next = [...current, Object.freeze(entry)];
  return Object.freeze(next.slice(Math.max(0, next.length - InitializationProgressLogMaxEntries)));
}
