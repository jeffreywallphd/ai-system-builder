import type { RuntimeHealthCheck } from "../../state/RuntimeConsoleStore";

export interface RuntimeHealthListProps {
  readonly healthChecks: ReadonlyArray<RuntimeHealthCheck>;
  readonly isRefreshing?: boolean;
  readonly onRefresh?: () => void;
}

export default function RuntimeHealthList({
  healthChecks,
  isRefreshing = false,
  onRefresh,
}: RuntimeHealthListProps): JSX.Element {
  return (
    <section className="ui-runtime-console__panel" aria-live="polite">
      <div className="ui-runtime-console__panel-header">
        <div>
          <div className="ui-runtime-console__panel-title">Server health</div>
          <div className="ui-runtime-console__panel-subtitle">
            Current runtime and MCP server availability for this workspace.
          </div>
        </div>
        <button
          className="ui-button ui-button--ghost ui-button--sm ui-runtime-console__action-button"
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing…" : "Refresh health"}
        </button>
      </div>

      {healthChecks.length === 0 ? (
        <div className="ui-runtime-console__empty">Health checks will appear here.</div>
      ) : (
        <ul className="ui-runtime-console__health-list">
          {healthChecks.map((check) => (
            <li key={check.id} className="ui-runtime-console__health-item">
              <span className={`ui-runtime-console__health-badge ui-runtime-console__health-badge--${check.status}`}>
                {check.status}
              </span>
              <div className="ui-runtime-console__health-copy">
                <div className="ui-runtime-console__health-label">{check.label}</div>
                <div className="ui-runtime-console__health-detail">{check.detail}</div>
              </div>
              <time className="ui-runtime-console__health-time" dateTime={check.checkedAt}>
                {new Date(check.checkedAt).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
