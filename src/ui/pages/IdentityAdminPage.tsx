import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  IdentityAdminAccountSummaryApiResponse,
  IdentityAdminAccountStatus,
  IdentitySessionSummaryApiResponse,
  TrustedDeviceSummaryApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";
import { ROUTE_PATHS } from "../routes/RouteConfig";
import { IdentityAuthService } from "../services/IdentityAuthService";
import { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";
import {
  SessionOversightPanel,
  TrustedDeviceOversightPanel,
} from "@shared/identity/IdentityTrustOversightPanels";

type AccountAction = "enable" | "disable";

export default function IdentityAdminPage(): JSX.Element {
  const authService = useMemo(() => new IdentityAuthService(), []);
  const sessionStore = useMemo(() => new IdentityAuthSessionStore(), []);
  const [session] = useState(() => sessionStore.getSession());
  const [accounts, setAccounts] = useState<ReadonlyArray<IdentityAdminAccountSummaryApiResponse>>(Object.freeze([]));
  const [selectedUserIdentityId, setSelectedUserIdentityId] = useState<string>();
  const [selectedAccount, setSelectedAccount] = useState<IdentityAdminAccountSummaryApiResponse>();
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingAccountStatus, setIsLoadingAccountStatus] = useState(false);
  const [isMutatingStatus, setIsMutatingStatus] = useState(false);
  const [accountsError, setAccountsError] = useState<string>();
  const [accountStatusError, setAccountStatusError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [actionStatus, setActionStatus] = useState<string>();
  const [adminDevices, setAdminDevices] = useState<ReadonlyArray<TrustedDeviceSummaryApiResponse>>(Object.freeze([]));
  const [selectedAdminTrustedDeviceId, setSelectedAdminTrustedDeviceId] = useState<string>();
  const [isLoadingAdminDevices, setIsLoadingAdminDevices] = useState(false);
  const [adminDevicesError, setAdminDevicesError] = useState<string>();
  const [adminWorkspaceFilter, setAdminWorkspaceFilter] = useState("");
  const [revokingTrustedDeviceId, setRevokingTrustedDeviceId] = useState<string>();
  const [adminSessions, setAdminSessions] = useState<ReadonlyArray<IdentitySessionSummaryApiResponse>>(Object.freeze([]));
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [isLoadingAdminSessions, setIsLoadingAdminSessions] = useState(false);
  const [adminSessionsError, setAdminSessionsError] = useState<string>();
  const [revokingSessionId, setRevokingSessionId] = useState<string>();

  const sessionToken = session?.sessionToken;
  const actorUserIdentityId = session?.userIdentityId;

  const loadAccounts = async (preferredSelectionId?: string): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    setIsLoadingAccounts(true);
    setAccountsError(undefined);
    try {
      const response = await authService.listIdentityAdminAccounts({
        context: { actorUserIdentityId },
      }, sessionToken);
      if (!response.ok || !response.data) {
        setAccounts(Object.freeze([]));
        setAccountsError(response.error?.message ?? "Unable to load local identity accounts.");
        return;
      }

      const nextAccounts = response.data.accounts;
      setAccounts(nextAccounts);

      if (nextAccounts.length === 0) {
        setSelectedUserIdentityId(undefined);
        setSelectedAccount(undefined);
        return;
      }

      const targetId = preferredSelectionId
        && nextAccounts.some((account) => account.userIdentityId === preferredSelectionId)
        ? preferredSelectionId
        : nextAccounts[0]?.userIdentityId;
      setSelectedUserIdentityId(targetId);
    } catch {
      setAccounts(Object.freeze([]));
      setAccountsError("Identity administration request failed. Verify the identity API is reachable and try again.");
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const loadAccountStatus = async (userIdentityId: string): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    setIsLoadingAccountStatus(true);
    setAccountStatusError(undefined);
    try {
      const response = await authService.getIdentityAdminAccountStatus({
        context: { actorUserIdentityId },
        userIdentityId,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setSelectedAccount(undefined);
        setAccountStatusError(response.error?.message ?? "Unable to load account status.");
        return;
      }

      setSelectedAccount(response.data.account);
    } catch {
      setSelectedAccount(undefined);
      setAccountStatusError("Identity administration request failed while loading account status.");
    } finally {
      setIsLoadingAccountStatus(false);
    }
  };

  const loadAdminDevices = async (userIdentityId: string, workspaceId?: string): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    setIsLoadingAdminDevices(true);
    setAdminDevicesError(undefined);
    try {
      const response = await authService.listIdentityAdminTrustedDevices({
        context: { actorUserIdentityId },
        userIdentityId,
        workspaceId,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setAdminDevices(Object.freeze([]));
        setSelectedAdminTrustedDeviceId(undefined);
        setAdminDevicesError(response.error?.message ?? "Unable to load trusted devices for the selected account.");
        return;
      }

      setAdminDevices(response.data.devices);
      const nextSelectedDeviceId = response.data.devices.some((device) => device.trustedDeviceId === selectedAdminTrustedDeviceId)
        ? selectedAdminTrustedDeviceId
        : response.data.devices[0]?.trustedDeviceId;
      setSelectedAdminTrustedDeviceId(nextSelectedDeviceId);
    } catch {
      setAdminDevices(Object.freeze([]));
      setSelectedAdminTrustedDeviceId(undefined);
      setAdminDevicesError("Identity administration request failed while loading trusted devices.");
    } finally {
      setIsLoadingAdminDevices(false);
    }
  };

  const loadAdminSessions = async (userIdentityId: string, preferredSelectionId?: string): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    setIsLoadingAdminSessions(true);
    setAdminSessionsError(undefined);
    try {
      const response = await authService.listIdentityAdminSessions({
        context: { actorUserIdentityId },
        userIdentityId,
        includeStatuses: ["active", "revoked", "expired"],
        limit: 200,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setAdminSessions(Object.freeze([]));
        setAdminSessionsError(response.error?.message ?? "Unable to load sessions for the selected account.");
        return;
      }

      setAdminSessions(response.data.sessions);
      if (response.data.sessions.length < 1) {
        setSelectedSessionId(undefined);
        return;
      }

      const targetId = preferredSelectionId && response.data.sessions.some((session) => session.sessionId === preferredSelectionId)
        ? preferredSelectionId
        : response.data.sessions[0]?.sessionId;
      setSelectedSessionId(targetId);
    } catch {
      setAdminSessions(Object.freeze([]));
      setAdminSessionsError("Identity administration request failed while loading sessions.");
    } finally {
      setIsLoadingAdminSessions(false);
    }
  };

  useEffect(() => {
    if (!sessionToken || !actorUserIdentityId) {
      return;
    }

    void loadAccounts();
  }, [sessionToken, actorUserIdentityId]);

  useEffect(() => {
    if (!selectedUserIdentityId) {
      setSelectedAccount(undefined);
      setAdminDevices(Object.freeze([]));
      setSelectedAdminTrustedDeviceId(undefined);
      setAdminSessions(Object.freeze([]));
      return;
    }

    void loadAccountStatus(selectedUserIdentityId);
    void loadAdminDevices(selectedUserIdentityId, normalizeOptionalInput(adminWorkspaceFilter));
    void loadAdminSessions(selectedUserIdentityId);
  }, [selectedUserIdentityId]);

  const setAccountStatus = async (action: AccountAction): Promise<void> => {
    if (!selectedUserIdentityId || !sessionToken || !actorUserIdentityId) {
      return;
    }

    setIsMutatingStatus(true);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.setIdentityAdminAccountStatus({
        context: { actorUserIdentityId },
        userIdentityId: selectedUserIdentityId,
        action,
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to update account status.");
        return;
      }

      setActionStatus(
        response.data.changed
          ? `Account status changed to ${response.data.status}.`
          : `Account status is already ${response.data.status}.`,
      );
      await loadAccounts(selectedUserIdentityId);
      await loadAccountStatus(selectedUserIdentityId);
    } catch {
      setActionError("Identity administration request failed while updating account status.");
    } finally {
      setIsMutatingStatus(false);
    }
  };

  const revokeTrustedDevice = async (device: TrustedDeviceSummaryApiResponse): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId || !selectedUserIdentityId) {
      return;
    }
    if (!window.confirm(`Revoke trust for "${device.displayName}"? Existing trusted sessions on this device may be invalidated.`)) {
      return;
    }

    setRevokingTrustedDeviceId(device.trustedDeviceId);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.revokeIdentityAdminTrustedDevice({
        context: { actorUserIdentityId },
        trustedDeviceId: device.trustedDeviceId,
        reason: "admin-action",
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to revoke trusted device.");
        return;
      }

      setActionStatus(response.data.revoked
        ? `Revoked trusted device "${device.displayName}".`
        : `Trusted device "${device.displayName}" was already revoked.`);
      await loadAdminDevices(selectedUserIdentityId, normalizeOptionalInput(adminWorkspaceFilter));
    } catch {
      setActionError("Identity administration request failed while revoking trusted device.");
    } finally {
      setRevokingTrustedDeviceId(undefined);
    }
  };

  const revokeAdminSession = async (targetSession: IdentitySessionSummaryApiResponse): Promise<void> => {
    if (!sessionToken || !actorUserIdentityId || !selectedUserIdentityId) {
      return;
    }
    if (!window.confirm("End this session? The user must sign in again on that client.")) {
      return;
    }

    setRevokingSessionId(targetSession.sessionId);
    setActionError(undefined);
    setActionStatus(undefined);
    try {
      const response = await authService.revokeIdentityAdminSession({
        context: { actorUserIdentityId },
        sessionId: targetSession.sessionId,
        reason: "admin",
      }, sessionToken);
      if (!response.ok || !response.data) {
        setActionError(response.error?.message ?? "Unable to revoke session.");
        return;
      }

      setActionStatus("Session ended.");
      await loadAdminSessions(selectedUserIdentityId, targetSession.sessionId);
    } catch {
      setActionError("Identity administration request failed while revoking session.");
    } finally {
      setRevokingSessionId(undefined);
    }
  };

  if (!sessionToken || !actorUserIdentityId || !session || sessionStore.isSessionExpired(session)) {
    return (
      <section className="ui-page ui-identity-admin-page">
        <div className="ui-card">
          <div className="ui-card__header">
            <h1 className="ui-card__title">Identity administration</h1>
            <p className="ui-card__subtitle">
              Sign in with an authenticated admin-capable account before managing local identities.
            </p>
          </div>
          <div className="ui-card__body">
            <Link className="ui-button ui-button--primary" to={ROUTE_PATHS.login}>Go to sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  const selectedStatus = selectedAccount?.accountStatus;
  const canEnable = selectedStatus === "suspended" || selectedStatus === "locked";
  const canDisable = selectedStatus === "pending-activation" || selectedStatus === "active";

  return (
    <section className="ui-page ui-identity-admin-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">Identity administration</h1>
          <p className="ui-page__subtitle">
            Inspect local account state, review active sessions, and enable or disable user access.
          </p>
        </div>
        <div className="ui-page__actions">
          <Link
            className="ui-button ui-button--secondary ui-button--sm"
            to={ROUTE_PATHS.trustedDevices}
          >
            Trusted devices
          </Link>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => {
              void loadAccounts(selectedUserIdentityId);
              if (selectedUserIdentityId) {
                void loadAccountStatus(selectedUserIdentityId);
                void loadAdminDevices(selectedUserIdentityId, normalizeOptionalInput(adminWorkspaceFilter));
                void loadAdminSessions(selectedUserIdentityId, selectedSessionId);
              }
            }}
            disabled={isLoadingAccounts || isLoadingAccountStatus || isLoadingAdminDevices || isLoadingAdminSessions}
          >
            Refresh
          </button>
        </div>
      </div>

      {accountsError ? <p className="ui-identity-admin-page__alert ui-identity-admin-page__alert--error" role="alert">{accountsError}</p> : null}
      {adminSessionsError ? <p className="ui-identity-admin-page__alert ui-identity-admin-page__alert--error" role="alert">{adminSessionsError}</p> : null}
      {actionError ? <p className="ui-identity-admin-page__alert ui-identity-admin-page__alert--error" role="alert">{actionError}</p> : null}
      {actionStatus ? <p className="ui-identity-admin-page__alert ui-identity-admin-page__alert--success" role="status">{actionStatus}</p> : null}

      <div className="ui-identity-admin-page__grid">
        <section className="ui-card ui-identity-admin-page__card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Local accounts</h2>
            <p className="ui-card__subtitle">Current local identity accounts with status and active session count.</p>
          </div>
          <div className="ui-card__body">
            {isLoadingAccounts ? <p className="ui-text-secondary">Loading local accounts...</p> : null}
            {!isLoadingAccounts && accounts.length === 0 ? (
              <p className="ui-text-secondary">No local identity accounts are registered yet.</p>
            ) : null}
            {accounts.length > 0 ? (
              <div className="ui-table-wrapper">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col">Status</th>
                      <th scope="col">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr
                        key={account.userIdentityId}
                        className={account.userIdentityId === selectedUserIdentityId ? "ui-identity-admin-page__table-row--selected" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="ui-button ui-button--ghost ui-button--sm ui-identity-admin-page__account-select"
                            onClick={() => setSelectedUserIdentityId(account.userIdentityId)}
                          >
                            {account.username}
                          </button>
                        </td>
                        <td>
                          <span className={`ui-badge ${statusBadgeClass(account.accountStatus)}`}>{account.accountStatus}</span>
                        </td>
                        <td>{account.activeSessionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="ui-card ui-identity-admin-page__card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Account status</h2>
            <p className="ui-card__subtitle">Inspect account state and apply enable or disable actions.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            {!selectedUserIdentityId ? <p className="ui-text-secondary">Select an account to inspect its status.</p> : null}
            {isLoadingAccountStatus ? <p className="ui-text-secondary">Loading account status...</p> : null}
            {accountStatusError ? <p className="ui-text-secondary" role="alert">{accountStatusError}</p> : null}
            {selectedAccount ? (
              <>
                <div className="ui-meta-grid">
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Username</span>
                    <span className="ui-meta-value">{selectedAccount.username}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Provider subject</span>
                    <span className="ui-meta-value">{selectedAccount.providerSubject}</span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Status</span>
                    <span className="ui-meta-value">
                      <span className={`ui-badge ${statusBadgeClass(selectedAccount.accountStatus)}`}>{selectedAccount.accountStatus}</span>
                    </span>
                  </div>
                  <div className="ui-meta-item">
                    <span className="ui-meta-label">Active sessions</span>
                    <span className="ui-meta-value">{selectedAccount.activeSessionCount}</span>
                  </div>
                </div>

                <div className="ui-page__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--secondary ui-button--sm"
                    onClick={() => {
                      void setAccountStatus("enable");
                    }}
                    disabled={!canEnable || isMutatingStatus}
                  >
                    {isMutatingStatus ? "Updating..." : "Enable account"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--primary ui-button--sm"
                    onClick={() => {
                      void setAccountStatus("disable");
                    }}
                    disabled={!canDisable || isMutatingStatus}
                  >
                    {isMutatingStatus ? "Updating..." : "Disable account"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section className="ui-card ui-identity-admin-page__card">
          <div className="ui-card__header">
            <h2 className="ui-card__title">Trust filters</h2>
            <p className="ui-card__subtitle">Scope trusted-device and session oversight for the selected account.</p>
          </div>
          <div className="ui-card__body ui-stack ui-stack--md">
            <label className="ui-field">
              <span className="ui-field__label">Workspace filter (optional)</span>
              <input
                className="ui-input"
                value={adminWorkspaceFilter}
                onChange={(event) => setAdminWorkspaceFilter(event.target.value)}
                placeholder="workspace id"
              />
            </label>
            <div className="ui-page__actions">
              <button
                type="button"
                className="ui-button ui-button--secondary ui-button--sm"
                disabled={!selectedUserIdentityId || isLoadingAdminDevices || isLoadingAdminSessions}
                onClick={() => {
                  if (selectedUserIdentityId) {
                    void loadAdminDevices(selectedUserIdentityId, normalizeOptionalInput(adminWorkspaceFilter));
                    void loadAdminSessions(selectedUserIdentityId, selectedSessionId);
                  }
                }}
              >
                {isLoadingAdminDevices || isLoadingAdminSessions ? "Loading..." : "Load oversight"}
              </button>
            </div>
            {adminDevicesError ? <p className="ui-text-secondary" role="alert">{adminDevicesError}</p> : null}
            {!selectedUserIdentityId ? <p className="ui-text-secondary">Select an account before loading trust oversight.</p> : null}
          </div>
        </section>

        <TrustedDeviceOversightPanel
          title="Trusted device oversight"
          subtitle="Inspect and revoke trusted devices for the selected account."
          devices={adminDevices}
          isLoading={isLoadingAdminDevices}
          selectedTrustedDeviceId={selectedAdminTrustedDeviceId}
          revokingTrustedDeviceId={revokingTrustedDeviceId}
          emptyMessage="No trusted devices match the current filter."
          onSelectTrustedDevice={setSelectedAdminTrustedDeviceId}
          onRevokeTrustedDevice={(device) => {
            void revokeTrustedDevice(device);
          }}
        />

        <SessionOversightPanel
          title="Session oversight"
          subtitle="Inspect active or historical sessions and revoke sessions that should no longer be valid."
          sessions={adminSessions}
          isLoading={isLoadingAdminSessions}
          selectedSessionId={selectedSessionId}
          revokingSessionId={revokingSessionId}
          emptyMessage="No sessions match the current filter."
          onSelectSession={setSelectedSessionId}
          onRevokeSession={(targetSession) => {
            void revokeAdminSession(targetSession);
          }}
        />
      </div>
    </section>
  );
}

function statusBadgeClass(status: IdentityAdminAccountStatus): string {
  switch (status) {
    case "active":
      return "ui-badge--success";
    case "suspended":
    case "locked":
      return "ui-badge--warning";
    case "deactivated":
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function normalizeOptionalInput(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

