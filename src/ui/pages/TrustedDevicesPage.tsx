import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  IdentitySessionSummaryApiResponse,
  InitiateTrustedDevicePairingApiResponse,
  TrustedDevicePairingArtifactType,
  TrustedDeviceSummaryApiResponse,
  ValidateTrustedDevicePairingApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import type { IdentityAuthSessionStore as IdentityAuthSessionStoreContract } from "@shared/identity/IdentityAuthSessionStore";
import {
  SessionOversightPanel,
  TrustedDeviceOversightPanel,
  formatDisplayDate,
} from "@ui/shared/identity/IdentityTrustOversightPanels";

interface TrustedDevicesPageProps {
  readonly authService?: IdentityAuthService;
  readonly sessionStore?: IdentityAuthSessionStoreContract;
}

export default function TrustedDevicesPage(props: TrustedDevicesPageProps = {}): JSX.Element {
  const authService = useMemo(() => props.authService ?? new IdentityAuthService(), [props.authService]);
  const sessionStore = useMemo(() => props.sessionStore ?? new IdentityAuthSessionStore(), [props.sessionStore]);
  const [session] = useState(() => sessionStore.getSession());
  const [devices, setDevices] = useState<ReadonlyArray<TrustedDeviceSummaryApiResponse>>(Object.freeze([]));
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [pairingDeviceId, setPairingDeviceId] = useState<string>();
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [actionStatus, setActionStatus] = useState<string>();
  const [artifactType, setArtifactType] = useState<TrustedDevicePairingArtifactType>("one-time-code");
  const [expiresInMinutes, setExpiresInMinutes] = useState(10);
  const [activePairing, setActivePairing] = useState<InitiateTrustedDevicePairingApiResponse>();
  const [presentedToken, setPresentedToken] = useState("");
  const [validationResult, setValidationResult] = useState<ValidateTrustedDevicePairingApiResponse>();
  const [isInitiating, setIsInitiating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string>();
  const [sessions, setSessions] = useState<ReadonlyArray<IdentitySessionSummaryApiResponse>>(Object.freeze([]));
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string>();
  const [revokingSessionId, setRevokingSessionId] = useState<string>();

  const sessionToken = session?.sessionToken;
  const userIdentityId = session?.userIdentityId;
  const hasAdministrativeRole = useMemo(
    () => resolveSessionRoleKeys(session).some((role) => role === "owner" || role === "admin"),
    [session],
  );

  const pairingCandidates = devices.filter((device) => device.trustStatus === "pending-pairing");
  const canCompletePairing = validationResult?.outcome === "valid";

  const loadDevices = async (preferredSelectionId?: string): Promise<void> => {
    if (!sessionToken || !userIdentityId) {
      return;
    }

    setIsLoadingDevices(true);
    setDevicesError(undefined);
    try {
      const response = await authService.listTrustedDevices({ userIdentityId }, sessionToken);
      if (!response.ok || !response.data) {
        setDevices(Object.freeze([]));
        setDevicesError(response.error?.message ?? "Unable to load trusted devices.");
        return;
      }

      const nextDevices = response.data.devices;
      setDevices(nextDevices);
      if (nextDevices.length === 0) {
        setSelectedDeviceId(undefined);
        setPairingDeviceId(undefined);
        return;
      }

      const nextSelected = preferredSelectionId && nextDevices.some((device) => device.trustedDeviceId === preferredSelectionId)
        ? preferredSelectionId
        : nextDevices[0]?.trustedDeviceId;
      setSelectedDeviceId(nextSelected);

      const pendingDevices = nextDevices.filter((device) => device.trustStatus === "pending-pairing");
      const nextPairingSelection = preferredSelectionId && pendingDevices.some((device) => device.trustedDeviceId === preferredSelectionId)
        ? preferredSelectionId
        : pendingDevices[0]?.trustedDeviceId;
      setPairingDeviceId(nextPairingSelection);
    } catch {
      setDevices(Object.freeze([]));
      setDevicesError("Trusted device request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsLoadingDevices(false);
    }
  };

  const loadSessions = async (preferredSelectionId?: string): Promise<void> => {
    if (!sessionToken) {
      return;
    }

    setIsLoadingSessions(true);
    setSessionsError(undefined);
    try {
      const response = await authService.listIdentitySessions({
        includeStatuses: ["active", "revoked", "expired"],
        limit: 200,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setSessions(Object.freeze([]));
        setSessionsError(response.error?.message ?? "Unable to load session oversight.");
        return;
      }

      const nextSessions = response.data.sessions;
      setSessions(nextSessions);
      if (nextSessions.length < 1) {
        setSelectedSessionId(undefined);
        return;
      }

      const nextSelected = preferredSelectionId && nextSessions.some((session) => session.sessionId === preferredSelectionId)
        ? preferredSelectionId
        : nextSessions[0]?.sessionId;
      setSelectedSessionId(nextSelected);
    } catch {
      setSessions(Object.freeze([]));
      setSessionsError("Session oversight request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (!sessionToken || !userIdentityId) {
      return;
    }
    void loadDevices();
    void loadSessions();
  }, [sessionToken, userIdentityId]);

  useEffect(() => {
    if (!pairingDeviceId || !activePairing?.pairingSession?.trustedDeviceId) {
      return;
    }
    if (activePairing.pairingSession.trustedDeviceId !== pairingDeviceId) {
      setActivePairing(undefined);
      setPresentedToken("");
      setValidationResult(undefined);
    }
  }, [activePairing, pairingDeviceId]);

  const initiatePairing = async (): Promise<void> => {
    if (!sessionToken || !userIdentityId || !pairingDeviceId) {
      return;
    }

    setIsInitiating(true);
    setActionError(undefined);
    setActionStatus(undefined);
    setValidationResult(undefined);
    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
      const response = await authService.initiateTrustedDevicePairing({
        trustedDeviceId: pairingDeviceId,
        userIdentityId,
        artifactType,
        actorBinding: {
          scope: "same-user",
          userIdentityId,
          sessionId: session?.sessionId,
        },
        issuance: {
          issuedByUserIdentityId: userIdentityId,
          channelHint: session?.sessionAccessChannel ?? "thin-client",
        },
        expiresAt,
      }, sessionToken);

      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to start trusted device pairing.");
        setActivePairing(undefined);
        return;
      }

      setActivePairing(response.data);
      setPresentedToken("");
      setActionStatus("Pairing started. Share the code or QR payload with the device you want to trust.");
    } catch {
      setActionError("Trusted device pairing initiation failed.");
      setActivePairing(undefined);
    } finally {
      setIsInitiating(false);
    }
  };

  const validatePairing = async (): Promise<void> => {
    if (!sessionToken || !userIdentityId || !pairingDeviceId || !activePairing) {
      return;
    }
    if (!presentedToken.trim()) {
      setActionError("Enter the pairing code or payload value before validation.");
      return;
    }

    setIsValidating(true);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.validateTrustedDevicePairing({
        pairingSessionId: activePairing.pairingSession.pairingSessionId,
        pairingTokenId: activePairing.pairingToken.pairingTokenId,
        trustedDeviceId: pairingDeviceId,
        userIdentityId,
        presentedToken: presentedToken.trim(),
      }, sessionToken);
      if (!response.ok || !response.data) {
        setValidationResult(undefined);
        setActionError(response.error?.message ?? "Unable to validate pairing artifact.");
        return;
      }

      setValidationResult(response.data);
      if (response.data.outcome === "valid") {
        setActionStatus("Pairing artifact validated. Complete pairing to trust this device.");
      } else {
        setActionError(getValidationOutcomeMessage(response.data));
      }
    } catch {
      setValidationResult(undefined);
      setActionError("Trusted device pairing validation failed.");
    } finally {
      setIsValidating(false);
    }
  };

  const completePairing = async (): Promise<void> => {
    if (!sessionToken || !userIdentityId || !pairingDeviceId || !activePairing) {
      return;
    }
    if (!presentedToken.trim()) {
      setActionError("Enter the pairing code or payload value before completion.");
      return;
    }

    setIsCompleting(true);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const issuedAt = new Date().toISOString();
      const response = await authService.completeTrustedDevicePairing({
        pairingSessionId: activePairing.pairingSession.pairingSessionId,
        pairingTokenId: activePairing.pairingToken.pairingTokenId,
        trustedDeviceId: pairingDeviceId,
        userIdentityId,
        presentedToken: presentedToken.trim(),
        completedByUserIdentityId: userIdentityId,
        trustMaterialRef: {
          materialId: `material:${pairingDeviceId}`,
          kind: "session-signing-key",
          issuedAt,
        },
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to complete trusted device pairing.");
        return;
      }

      setActionStatus(`Pairing complete. "${response.data.trustedDevice.displayName}" is now trusted.`);
      setActivePairing(undefined);
      setPresentedToken("");
      setValidationResult(undefined);
      await loadDevices(pairingDeviceId);
    } catch {
      setActionError("Trusted device pairing completion failed.");
    } finally {
      setIsCompleting(false);
    }
  };

  const revokeDevice = async (device: TrustedDeviceSummaryApiResponse): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    if (!canManageTrustedDeviceTarget(session, device)) {
      setActionError("Your current session can only revoke trusted devices for your own identity.");
      return;
    }
    if (!window.confirm(`Revoke trust for "${device.displayName}"? Existing trusted sessions on this device may be invalidated.`)) {
      return;
    }

    setRevokingDeviceId(device.trustedDeviceId);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.revokeTrustedDevice({
        trustedDeviceId: device.trustedDeviceId,
        reason: "user-request",
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to revoke trusted device.");
        return;
      }

      setActionStatus(response.data.revoked
        ? `Revoked trust for "${device.displayName}".`
        : `Trust for "${device.displayName}" was already revoked.`);
      await loadDevices(device.trustedDeviceId);
    } catch {
      setActionError("Trusted device revocation failed.");
    } finally {
      setRevokingDeviceId(undefined);
    }
  };

  const revokeSession = async (targetSession: IdentitySessionSummaryApiResponse): Promise<void> => {
    if (!sessionToken) {
      return;
    }
    if (!canManageIdentitySessionTarget(session, targetSession)) {
      setActionError("Your current session can only end sessions for your own identity.");
      return;
    }
    if (!window.confirm("End this session? The user will need to sign in again on that client.")) {
      return;
    }

    setRevokingSessionId(targetSession.sessionId);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.revokeIdentitySession({
        sessionId: targetSession.sessionId,
        reason: "security",
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to end session.");
        return;
      }

      setActionStatus("Session ended.");
      await loadSessions(targetSession.sessionId);
    } catch {
      setActionError("Session revocation failed.");
    } finally {
      setRevokingSessionId(undefined);
    }
  };

  if (!sessionToken || !userIdentityId || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-trusted-devices-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Trusted devices</h1>
            <p className="ui-card__subtitle">
              Sign in before pairing or revoking trusted devices.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-page ui-trusted-devices-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Trusted devices</h1>
          <p className="ui-page__subtitle">
            Pair pending devices, review trust status, and revoke trust when a device is no longer safe to use.
          </p>
        </div>
        <div className="ui-page__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => {
              void loadDevices(selectedDeviceId);
              void loadSessions(selectedSessionId);
            }}
            disabled={isLoadingDevices || isLoadingSessions}
          >
            Refresh
          </button>
        </div>
      </div>

      {devicesError ? <p className="ui-trusted-devices-page__alert ui-trusted-devices-page__alert--error" role="alert">{devicesError}</p> : null}
      {sessionsError ? <p className="ui-trusted-devices-page__alert ui-trusted-devices-page__alert--error" role="alert">{sessionsError}</p> : null}
      {actionError ? <p className="ui-trusted-devices-page__alert ui-trusted-devices-page__alert--error" role="alert">{actionError}</p> : null}
      {actionStatus ? <p className="ui-trusted-devices-page__alert ui-trusted-devices-page__alert--success" role="status">{actionStatus}</p> : null}
      {!hasAdministrativeRole ? (
        <p className="ui-trusted-devices-page__alert ui-trusted-devices-page__alert--warning" role="status">
          Admin-lite boundary: this session can only revoke trusted devices and sessions associated with your own identity.
        </p>
      ) : null}

      <div className="ui-trusted-devices-page__grid">
        <section className="ui-card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Device pairing</h2>
            <p className="ui-card__subtitle">Start pairing and finish trust enrollment with a one-time artifact.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            {pairingCandidates.length === 0 ? (
              <p className="ui-text-secondary">
                No pending devices are ready for pairing yet. A pending record must exist before pairing starts.
              </p>
            ) : (
              <>
                <label className="ui-field">
                  <span className="ui-field__label">Pending device</span>
                  <select
                    className="ui-select"
                    value={pairingDeviceId ?? ""}
                    onChange={(event) => setPairingDeviceId(event.target.value || undefined)}
                  >
                    {pairingCandidates.map((device) => (
                      <option key={device.trustedDeviceId} value={device.trustedDeviceId}>
                        {device.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ui-trusted-devices-page__pairing-options">
                  <label className="ui-field">
                    <span className="ui-field__label">Artifact type</span>
                    <select
                      className="ui-select"
                      value={artifactType}
                      onChange={(event) => setArtifactType(event.target.value as TrustedDevicePairingArtifactType)}
                    >
                      <option value="one-time-code">One-time code</option>
                      <option value="qr-payload">QR-ready payload</option>
                    </select>
                  </label>
                  <label className="ui-field">
                    <span className="ui-field__label">Expires in (minutes)</span>
                    <input
                      className="ui-input"
                      type="number"
                      min={1}
                      max={60}
                      value={expiresInMinutes}
                      onChange={(event) => setExpiresInMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="ui-button ui-button--primary ui-button--sm"
                  onClick={() => {
                    void initiatePairing();
                  }}
                  disabled={isInitiating || !pairingDeviceId}
                >
                  {isInitiating ? "Starting..." : "Start pairing"}
                </button>
              </>
            )}

            {activePairing ? (
              <div className="ui-trusted-devices-page__pairing-panel ui-stack ui-stack--sm">
                <div className="ui-meta-grid">
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Artifact</span>
                    <span className="ui-meta-value">{activePairing.artifact.type === "qr-payload" ? "QR-ready payload" : "One-time code"}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Expires</span>
                    <span className="ui-meta-value">{formatDisplayDate(activePairing.pairingToken.expiresAt)}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Attempts left</span>
                    <span className="ui-meta-value">
                      {Math.max(activePairing.pairingToken.maxValidationAttempts - activePairing.pairingToken.failedValidationAttempts, 0)}
                    </span>
                  </div>
                </div>
                <label className="ui-field">
                  <span className="ui-field__label">
                    {activePairing.artifact.type === "qr-payload" ? "QR payload value" : "One-time code"}
                  </span>
                  <input className="ui-input ui-trusted-devices-page__artifact-value" value={activePairing.artifact.value} readOnly />
                </label>
                <label className="ui-field">
                  <span className="ui-field__label">Confirm pairing artifact</span>
                  <input
                    className="ui-input"
                    value={presentedToken}
                    onChange={(event) => setPresentedToken(event.target.value)}
                    placeholder="Enter code or payload from the device flow"
                  />
                </label>
                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    onClick={() => {
                      void validatePairing();
                    }}
                    disabled={isValidating || !presentedToken.trim()}
                  >
                    {isValidating ? "Validating..." : "Validate artifact"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    onClick={() => {
                      void completePairing();
                    }}
                    disabled={isCompleting || !canCompletePairing}
                  >
                    {isCompleting ? "Completing..." : "Complete pairing"}
                  </button>
                </div>
                {validationResult ? (
                  <p className="ui-text-secondary">
                    Validation outcome: <strong>{validationResult.outcome}</strong>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <TrustedDeviceOversightPanel
          title="Trusted device management"
          subtitle="Review trust state, registration timing, and recent device activity."
          devices={devices}
          isLoading={isLoadingDevices}
          selectedTrustedDeviceId={selectedDeviceId}
          revokingTrustedDeviceId={revokingDeviceId}
          emptyMessage="No trusted devices are registered for this account."
          onSelectTrustedDevice={setSelectedDeviceId}
          onRevokeTrustedDevice={(device) => {
            void revokeDevice(device);
          }}
        />

        <SessionOversightPanel
          title="Active session oversight"
          subtitle="Review current and historical sessions and end sessions that should no longer be active."
          sessions={sessions}
          isLoading={isLoadingSessions}
          selectedSessionId={selectedSessionId}
          currentSessionId={session.sessionId}
          revokingSessionId={revokingSessionId}
          emptyMessage="No sessions are available for this account."
          onSelectSession={setSelectedSessionId}
          onRevokeSession={(targetSession) => {
            void revokeSession(targetSession);
          }}
        />
      </div>
    </section>
  );
}

function getValidationOutcomeMessage(response: ValidateTrustedDevicePairingApiResponse): string {
  switch (response.outcome) {
    case "expired":
      return "This pairing artifact expired. Start pairing again to issue a fresh code.";
    case "reused":
      return "This pairing artifact was already used and cannot be reused.";
    case "invalidated":
      return "This pairing artifact was invalidated. Start pairing again.";
    case "attempts-exhausted":
      return "Too many failed attempts. Start pairing again to issue a new artifact.";
    case "actor-scope-violation":
      return "This pairing request is not authorized for the active user.";
    case "invalid":
      return `The pairing artifact is invalid. ${response.attemptsRemaining} attempts remain.`;
    case "valid":
      return "Pairing artifact is valid.";
    default:
      return "Unable to validate the pairing artifact.";
  }
}

export function canManageTrustedDeviceTarget(
  session: ReturnType<IdentityAuthSessionStore["getSession"]>,
  targetDevice: Pick<TrustedDeviceSummaryApiResponse, "userIdentityId">,
): boolean {
  if (!session?.userIdentityId) {
    return false;
  }
  if (resolveSessionRoleKeys(session).some((role) => role === "owner" || role === "admin")) {
    return true;
  }
  return session.userIdentityId === targetDevice.userIdentityId;
}

export function canManageIdentitySessionTarget(
  session: ReturnType<IdentityAuthSessionStore["getSession"]>,
  targetSession: Pick<IdentitySessionSummaryApiResponse, "userIdentityId">,
): boolean {
  if (!session?.userIdentityId) {
    return false;
  }
  if (resolveSessionRoleKeys(session).some((role) => role === "owner" || role === "admin")) {
    return true;
  }
  return session.userIdentityId === targetSession.userIdentityId;
}

function resolveSessionRoleKeys(
  session: ReturnType<IdentityAuthSessionStore["getSession"]>,
): ReadonlyArray<"owner" | "admin" | "member" | "viewer"> {
  if (!session) {
    return Object.freeze([]);
  }
  const workspaceId = session.workspaceContext?.resolvedWorkspaceId
    ?? session.workspaceContext?.requestedWorkspaceId
    ?? session.initialCapabilityState?.workspaceId;
  const workspaceRoles = workspaceId
    ? session.workspaceContext?.workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.effectiveRoles
    : undefined;
  return workspaceRoles ?? session.initialCapabilityState?.effectiveRoles ?? Object.freeze([]);
}

