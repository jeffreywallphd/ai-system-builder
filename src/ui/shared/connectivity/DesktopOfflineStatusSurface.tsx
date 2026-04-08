import type { OfflineSynchronizationStateSnapshotDto } from "@shared/contracts/runtime/OfflineSynchronizationContracts";
import { buildDesktopOfflineStatusSurfaceModel } from "../../presenters/DesktopOfflineStatusPresenter";

export interface DesktopOfflineStatusSurfaceProps {
  readonly snapshot?: OfflineSynchronizationStateSnapshotDto;
  readonly isLoading: boolean;
  readonly isTogglingOfflineMode: boolean;
  readonly errorMessage?: string;
  readonly onRefresh: () => void;
  readonly onToggleOfflineMode: (active: boolean) => void;
}

export default function DesktopOfflineStatusSurface({
  snapshot,
  isLoading,
  isTogglingOfflineMode,
  errorMessage,
  onRefresh,
  onToggleOfflineMode,
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
    </section>
  );
}
