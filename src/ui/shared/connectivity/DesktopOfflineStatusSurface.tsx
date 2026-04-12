import type { OfflineSynchronizationStateSnapshotDto } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { buildDesktopOfflineStatusSurfaceModel } from "../../presenters/DesktopOfflineStatusPresenter";

export interface DesktopOfflineStatusSurfaceProps {
  readonly snapshot?: OfflineSynchronizationStateSnapshotDto;
  readonly isLoading: boolean;
  readonly isTogglingOfflineMode: boolean;
  readonly errorMessage?: string;
  readonly onRefresh: () => void;
  readonly onToggleOfflineMode: (active: boolean) => void;
  readonly onOpenPreservedDrafts?: () => void;
  readonly onOpenSyncConflicts?: () => void;
  readonly onOpenReplayOutcomes?: () => void;
}

export default function DesktopOfflineStatusSurface({
  snapshot,
  isLoading,
  isTogglingOfflineMode,
  errorMessage,
  onRefresh,
  onToggleOfflineMode,
  onOpenPreservedDrafts,
  onOpenSyncConflicts,
  onOpenReplayOutcomes,
}: DesktopOfflineStatusSurfaceProps): JSX.Element | null {
  if (!snapshot && !isLoading && !errorMessage) {
    return null;
  }

  if (!snapshot) {
    return (
      <section className="ui-offline-status ui-offline-status--state-neutral" data-testid="desktop-offline-status-surface">
        <div className="ui-offline-status__banner">
          <strong>Offline/local status unavailable</strong>
          <span>{errorMessage ?? "Resolving desktop connectivity state..."}</span>
        </div>
      </section>
    );
  }

  const model = buildDesktopOfflineStatusSurfaceModel(snapshot);
  const unsupportedActions = model.policy.unsupportedActions;
  const followUpHandlers: Record<"preserved-drafts" | "sync-conflicts" | "replay-outcomes", (() => void) | undefined> = {
    "preserved-drafts": onOpenPreservedDrafts,
    "sync-conflicts": onOpenSyncConflicts,
    "replay-outcomes": onOpenReplayOutcomes,
  };

  return (
    <section
      className={`ui-offline-status ui-offline-status--state-${model.banner.tone}`}
      data-testid="desktop-offline-status-surface"
      aria-live="polite"
    >
      <div className="ui-offline-status__banner">
        <div className="ui-offline-status__banner-copy">
          <strong>{model.banner.title}</strong>
          <span>{model.banner.message}</span>
        </div>
        <div className="ui-page__actions">
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--small"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : model.actions.refreshLabel}
          </button>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--small"
            onClick={() => onToggleOfflineMode(!snapshot.connectivity.localModeActive)}
            disabled={isTogglingOfflineMode}
          >
            {isTogglingOfflineMode ? "Updating..." : model.actions.offlineModeToggleLabel}
          </button>
        </div>
      </div>

      {errorMessage ? <p className="ui-offline-status__error" role="alert">{errorMessage}</p> : null}

      <div className="ui-offline-status__panels">
        <article className="ui-offline-status__panel">
          <h2>Connectivity</h2>
          <p className="ui-offline-status__panel-value">{model.connectivity.label}</p>
          <p className="ui-text-small ui-text-secondary">
            Last changed: {model.connectivity.lastChangedAtLabel}
            {model.connectivity.stale ? " (stale)" : ""}
          </p>
          {model.connectivity.detail ? <p className="ui-text-small ui-text-secondary">{model.connectivity.detail}</p> : null}
        </article>

        <article className="ui-offline-status__panel">
          <h2>Pending sync</h2>
          <p className="ui-offline-status__panel-value">{model.synchronization.stateLabel}</p>
          <p className="ui-text-small ui-text-secondary">{model.synchronization.summary}</p>
        </article>

        <article className="ui-offline-status__panel">
          <h2>Cached resources</h2>
          <p className="ui-offline-status__panel-value">{model.cache.totalCount}</p>
          <p className="ui-text-small ui-text-secondary">{model.cache.summary}</p>
        </article>

        <article className="ui-offline-status__panel">
          <h2>Policy-limited actions</h2>
          {unsupportedActions.length === 0 ? (
            <p className="ui-text-small ui-text-secondary">No policy-limited actions are currently blocked.</p>
          ) : (
            <ul className="ui-offline-status__list">
              {unsupportedActions.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <div className="ui-offline-status__details">
        <article className="ui-offline-status__detail-panel">
          <h2>Preserved drafts</h2>
          <p className="ui-offline-status__panel-value">{model.drafts.unsyncedCount}</p>
          <p className="ui-text-small ui-text-secondary">{model.drafts.summary}</p>
          {model.drafts.preserved.length < 1 ? (
            <p className="ui-text-small ui-text-secondary">No unsynced drafts are waiting for manual recovery.</p>
          ) : (
            <ul className="ui-offline-status__list ui-offline-status__list--spaced">
              {model.drafts.preserved.map((draft) => (
                <li key={draft.draftId}>
                  <strong>{draft.syncStatusLabel}:</strong> {draft.resourceLabel}
                  <br />
                  <span className="ui-text-secondary">Changes: {draft.localChangeCount}, Last edited: {draft.lastEditedAtLabel}</span>
                  <br />
                  <span className="ui-text-secondary">{draft.recommendedAction}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="ui-offline-status__detail-panel">
          <h2>Sync conflicts</h2>
          <p className="ui-offline-status__panel-value">{model.conflicts.totalCount}</p>
          <p className="ui-text-small ui-text-secondary">{model.conflicts.summary}</p>
          {model.conflicts.entries.length < 1 ? (
            <p className="ui-text-small ui-text-secondary">No preserved conflict records are currently available.</p>
          ) : (
            <ul className="ui-offline-status__list ui-offline-status__list--spaced">
              {model.conflicts.entries.map((entry) => (
                <li key={entry.key}>
                  <strong>{entry.severityLabel.toUpperCase()}:</strong> {entry.title}
                  <br />
                  <span className="ui-text-secondary">{entry.summary}</span>
                  <br />
                  <span className="ui-text-secondary">Detected: {entry.detectedAtLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="ui-offline-status__detail-panel">
          <h2>Replay outcomes</h2>
          <p className="ui-offline-status__panel-value">{model.replayOutcomes.totalCount}</p>
          <p className="ui-text-small ui-text-secondary">{model.replayOutcomes.summary}</p>
          {model.replayOutcomes.entries.length < 1 ? (
            <p className="ui-text-small ui-text-secondary">Reconnect replay has not produced outcomes yet.</p>
          ) : (
            <ul className="ui-offline-status__list ui-offline-status__list--spaced">
              {model.replayOutcomes.entries.map((entry) => (
                <li key={entry.key}>
                  <strong>{entry.title}</strong>
                  <br />
                  <span className="ui-text-secondary">{entry.reason}</span>
                  <br />
                  <span className="ui-text-secondary">Resolved: {entry.resolvedAtLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="ui-offline-status__detail-panel">
          <h2>Recovery actions</h2>
          <ul className="ui-offline-status__action-list">
            {model.followUp.actions.map((action) => {
              const handler = followUpHandlers[action.actionKey];
              return (
                <li key={action.actionKey} className="ui-offline-status__action-item">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--small"
                    disabled={!action.enabled || !handler}
                    onClick={() => {
                      handler?.();
                    }}
                  >
                    {action.label}
                  </button>
                  <span className="ui-text-small ui-text-secondary">{action.description}</span>
                  {!action.enabled && action.unavailableReason ? (
                    <span className="ui-text-small ui-text-secondary">{action.unavailableReason}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {model.followUp.limitations.length < 1 ? null : (
            <>
              <h3 className="ui-offline-status__subheading">Reconciliation limits</h3>
              <ul className="ui-offline-status__list">
                {model.followUp.limitations.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
