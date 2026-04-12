import type {
  IdentitySessionSummaryApiResponse,
  TrustedDeviceSummaryApiResponse,
} from "@infrastructure/api/identity/sdk/PublicIdentityAuthApiContract";

export interface TrustedDeviceOversightPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly devices: ReadonlyArray<TrustedDeviceSummaryApiResponse>;
  readonly isLoading?: boolean;
  readonly selectedTrustedDeviceId?: string;
  readonly revokingTrustedDeviceId?: string;
  readonly emptyMessage: string;
  readonly loadingMessage?: string;
  readonly onSelectTrustedDevice: (trustedDeviceId: string) => void;
  readonly onRevokeTrustedDevice?: (device: TrustedDeviceSummaryApiResponse) => void;
}

export function TrustedDeviceOversightPanel({
  title,
  subtitle,
  devices,
  isLoading = false,
  selectedTrustedDeviceId,
  revokingTrustedDeviceId,
  emptyMessage,
  loadingMessage = "Loading trusted devices...",
  onSelectTrustedDevice,
  onRevokeTrustedDevice,
}: TrustedDeviceOversightPanelProps): JSX.Element {
  const selectedDevice = devices.find((device) => device.trustedDeviceId === selectedTrustedDeviceId);

  return (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">{title}</h2>
        <p className="ui-card__subtitle">{subtitle}</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--md">
        {isLoading ? <p className="ui-text-secondary">{loadingMessage}</p> : null}
        {!isLoading && devices.length < 1 ? <p className="ui-text-secondary">{emptyMessage}</p> : null}

        {devices.length > 0 ? (
          <div className="ui-table-wrapper">
            <table className="ui-table ui-responsive-table__table">
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Trust</th>
                  <th scope="col">Workspace</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.trustedDeviceId}
                    className={device.trustedDeviceId === selectedTrustedDeviceId ? "ui-trust-oversight__table-row--selected" : undefined}
                  >
                    <td data-label="Device">
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        onClick={() => onSelectTrustedDevice(device.trustedDeviceId)}
                      >
                        {device.displayName}
                      </button>
                    </td>
                    <td data-label="Trust"><span className={`ui-badge ${statusBadgeClass(device.trustStatus)}`}>{device.trustStatus}</span></td>
                    <td data-label="Workspace">{device.workspaceId ?? "Global"}</td>
                    <td data-label="Last seen">{device.lastSeenAt ? formatDisplayDate(device.lastSeenAt) : "Never"}</td>
                    <td data-label="Actions">
                      {onRevokeTrustedDevice ? (
                        <button
                          type="button"
                          className="ui-button ui-button--danger ui-button--sm"
                          disabled={device.trustStatus === "revoked" || revokingTrustedDeviceId === device.trustedDeviceId}
                          onClick={() => {
                            onRevokeTrustedDevice(device);
                          }}
                        >
                          {revokingTrustedDeviceId === device.trustedDeviceId ? "Revoking..." : "Revoke"}
                        </button>
                      ) : (
                        <span className="ui-text-secondary ui-text-small">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedDevice ? (
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <span className="ui-meta-label">Device</span>
              <span className="ui-meta-value">{selectedDevice.displayName}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Pairing method</span>
              <span className="ui-meta-value">{selectedDevice.pairingMethod}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Paired at</span>
              <span className="ui-meta-value">{selectedDevice.pairedAt ? formatDisplayDate(selectedDevice.pairedAt) : "Not paired"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Platform</span>
              <span className="ui-meta-value">{selectedDevice.metadata.platform ?? "Unknown"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Trust binding</span>
              <span className="ui-meta-value">{redactIdentifier(selectedDevice.trustedDeviceId)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export interface SessionOversightPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly sessions: ReadonlyArray<IdentitySessionSummaryApiResponse>;
  readonly isLoading?: boolean;
  readonly selectedSessionId?: string;
  readonly currentSessionId?: string;
  readonly revokingSessionId?: string;
  readonly emptyMessage: string;
  readonly loadingMessage?: string;
  readonly onSelectSession: (sessionId: string) => void;
  readonly onRevokeSession: (session: IdentitySessionSummaryApiResponse) => void;
}

export function SessionOversightPanel({
  title,
  subtitle,
  sessions,
  isLoading = false,
  selectedSessionId,
  currentSessionId,
  revokingSessionId,
  emptyMessage,
  loadingMessage = "Loading sessions...",
  onSelectSession,
  onRevokeSession,
}: SessionOversightPanelProps): JSX.Element {
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId);

  return (
    <section className="ui-card">
      <div className="ui-card__header">
        <h2 className="ui-card__title">{title}</h2>
        <p className="ui-card__subtitle">{subtitle}</p>
      </div>
      <div className="ui-card__body ui-stack ui-stack--md">
        {isLoading ? <p className="ui-text-secondary">{loadingMessage}</p> : null}
        {!isLoading && sessions.length < 1 ? <p className="ui-text-secondary">{emptyMessage}</p> : null}

        {sessions.length > 0 ? (
          <div className="ui-table-wrapper">
            <table className="ui-table ui-responsive-table__table">
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Status</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const isTerminal = session.status === "revoked" || session.status === "expired" || session.status === "rotated";
                  const isCurrent = session.sessionId === currentSessionId;
                  return (
                    <tr
                      key={session.sessionId}
                      className={session.sessionId === selectedSessionId ? "ui-trust-oversight__table-row--selected" : undefined}
                    >
                      <td data-label="Session">
                        <button
                          type="button"
                          className="ui-button ui-button--ghost ui-button--sm"
                          onClick={() => onSelectSession(session.sessionId)}
                        >
                          {redactIdentifier(session.sessionId)}
                        </button>
                        {isCurrent ? <span className="ui-badge ui-badge--neutral ui-trust-oversight__current-badge">Current</span> : null}
                      </td>
                      <td data-label="Status"><span className={`ui-badge ${statusBadgeClass(session.status)}`}>{session.status}</span></td>
                      <td data-label="Channel">{session.accessChannel ?? "Unknown"}</td>
                      <td data-label="Expires">{formatDisplayDate(session.expiresAt)}</td>
                      <td data-label="Actions">
                        <button
                          type="button"
                          className="ui-button ui-button--danger ui-button--sm"
                          disabled={isTerminal || revokingSessionId === session.sessionId}
                          onClick={() => {
                            onRevokeSession(session);
                          }}
                        >
                          {revokingSessionId === session.sessionId ? "Ending..." : "End session"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedSession ? (
          <div className="ui-meta-grid">
            <div className="ui-meta-item">
              <span className="ui-meta-label">Session ID</span>
              <span className="ui-meta-value">{redactIdentifier(selectedSession.sessionId)}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Device ID</span>
              <span className="ui-meta-value">{selectedSession.deviceId ? redactIdentifier(selectedSession.deviceId) : "Unknown"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Trusted device</span>
              <span className="ui-meta-value">{selectedSession.trust?.trustedDeviceId ? redactIdentifier(selectedSession.trust.trustedDeviceId) : "Not bound"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Assurance</span>
              <span className="ui-meta-value">{selectedSession.trust?.sessionAssuranceLevel ?? "authenticated-untrusted"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Trust state</span>
              <span className="ui-meta-value">{selectedSession.trust?.trustState ?? "unknown"}</span>
            </div>
            <div className="ui-meta-item">
              <span className="ui-meta-label">Issued</span>
              <span className="ui-meta-value">{formatDisplayDate(selectedSession.issuedAt)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function statusBadgeClass(status: string): string {
  if (status === "trusted" || status === "active") {
    return "ui-badge--success";
  }
  if (status === "pending-pairing") {
    return "ui-badge--warning";
  }
  if (status === "revoked" || status === "expired") {
    return "ui-badge--danger";
  }
  return "ui-badge--neutral";
}

export function formatDisplayDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

export function redactIdentifier(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 10) {
    return "[redacted]";
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}
