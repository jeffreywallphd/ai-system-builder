import type { RuntimeRealtimeConnectionStateSnapshot } from "@shared/runtime/RuntimeRealtimeSubscriptionService";

export interface OperationalRealtimeBannerProps {
  readonly connectionState: RuntimeRealtimeConnectionStateSnapshot;
  readonly onRefresh: () => void;
  readonly onReconnect: () => void;
  readonly refreshLabel?: string;
  readonly reconnectLabel?: string;
  readonly className?: string;
}

export interface OperationalRealtimeStatusPillProps {
  readonly connectionState: RuntimeRealtimeConnectionStateSnapshot;
  readonly staleLabel?: string;
}

export function OperationalRealtimeBanner({
  connectionState,
  onRefresh,
  onReconnect,
  refreshLabel = "Refresh operational data",
  reconnectLabel = "Reconnect live updates",
  className,
}: OperationalRealtimeBannerProps): JSX.Element {
  const tone = mapRealtimeStateToTone(connectionState);
  const summary = toRealtimeSummary(connectionState);
  const staleLabel = connectionState.stale ? "stale data fallback active" : "live event stream active";
  const classes = className
    ? `ui-operational-realtime-banner ui-operational-realtime-banner--${tone} ${className}`
    : `ui-operational-realtime-banner ui-operational-realtime-banner--${tone}`;

  return (
    <section className={classes} role={tone === "danger" ? "alert" : "status"} aria-live={tone === "danger" ? "assertive" : "polite"} data-testid="operational-realtime-banner">
      <div className="ui-operational-realtime-banner__copy">
        <strong>{summary}</strong>
        <span className="ui-text-small ui-text-secondary">{staleLabel}</span>
        {connectionState.detail ? <span className="ui-text-small ui-text-secondary">{connectionState.detail}</span> : null}
      </div>
      <div className="ui-page__actions">
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          onClick={onRefresh}
        >
          {refreshLabel}
        </button>
        <button
          type="button"
          className="ui-button ui-button--ghost ui-button--small"
          onClick={onReconnect}
          disabled={connectionState.state === "connecting"}
        >
          {reconnectLabel}
        </button>
      </div>
    </section>
  );
}

export function OperationalRealtimeStatusPill({
  connectionState,
  staleLabel = "stale",
}: OperationalRealtimeStatusPillProps): JSX.Element {
  const tone = mapRealtimeStateToTone(connectionState);
  return (
    <span className={`ui-badge ui-badge--${tone}`}>
      Live updates: {toRealtimeSummary(connectionState)}
      {connectionState.stale ? ` (${staleLabel})` : ""}
    </span>
  );
}

function toRealtimeSummary(connectionState: RuntimeRealtimeConnectionStateSnapshot): string {
  if (connectionState.state === "connected") {
    return "Connected";
  }
  if (connectionState.state === "connecting") {
    return "Connecting";
  }
  if (connectionState.state === "reconnecting") {
    return "Reconnecting";
  }
  if (connectionState.state === "degraded") {
    return "Degraded";
  }
  return "Disconnected";
}

function mapRealtimeStateToTone(
  connectionState: RuntimeRealtimeConnectionStateSnapshot,
): "neutral" | "success" | "warning" | "danger" {
  if (connectionState.state === "connected" && !connectionState.stale) {
    return "success";
  }
  if (connectionState.state === "disconnected") {
    return "danger";
  }
  if (connectionState.state === "degraded" || connectionState.state === "reconnecting") {
    return "warning";
  }
  return "neutral";
}
