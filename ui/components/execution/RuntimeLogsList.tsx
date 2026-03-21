import type { RuntimeConsoleLogEntry } from "../../state/RuntimeConsoleStore";

export type RuntimeConsoleLogFilter = "all" | "error" | "warn" | "info";

export interface RuntimeLogsListProps {
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
  readonly activeFilter: RuntimeConsoleLogFilter;
  readonly onFilterChange: (filter: RuntimeConsoleLogFilter) => void;
  readonly onClearLogs: () => void;
  readonly onRefreshHealth: () => void;
  readonly onRestartRuntime?: () => void;
  readonly canRestartRuntime?: boolean;
  readonly isRestartingRuntime?: boolean;
}

const FILTER_OPTIONS: ReadonlyArray<{ value: RuntimeConsoleLogFilter; label: string }> = Object.freeze([
  { value: "all", label: "All" },
  { value: "error", label: "Errors" },
  { value: "warn", label: "Warnings" },
  { value: "info", label: "Info" },
]);

export default function RuntimeLogsList({
  logs,
  activeFilter,
  onFilterChange,
  onClearLogs,
  onRefreshHealth,
  onRestartRuntime,
  canRestartRuntime = false,
  isRestartingRuntime = false,
}: RuntimeLogsListProps): JSX.Element {
  const filteredLogs = filterRuntimeLogs(logs, activeFilter);

  return (
    <section className="ui-runtime-console__panel" aria-live="polite">
      <div className="ui-runtime-console__panel-header">
        <div>
          <div className="ui-runtime-console__panel-title">Runtime logs</div>
          <div className="ui-runtime-console__panel-subtitle">
            Consolidated runtime, network, MCP, and UI diagnostics retained for mobile troubleshooting.
          </div>
        </div>
        <div className="ui-runtime-console__actions" aria-label="Runtime log actions">
          <button className="ui-button ui-button--ghost ui-button--sm ui-runtime-console__action-button" type="button" onClick={onRefreshHealth}>
            Refresh health
          </button>
          <button className="ui-button ui-button--ghost ui-button--sm ui-runtime-console__action-button" type="button" onClick={onClearLogs}>
            Clear logs
          </button>
          {onRestartRuntime ? (
            <button
              className="ui-button ui-button--secondary ui-button--sm ui-runtime-console__action-button"
              type="button"
              disabled={!canRestartRuntime || isRestartingRuntime}
              onClick={onRestartRuntime}
            >
              {isRestartingRuntime ? "Restarting…" : "Restart runtime"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="ui-runtime-console__filters" role="toolbar" aria-label="Runtime log filters">
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter.value}
            className={`ui-button ui-button--sm ui-runtime-console__filter${activeFilter === filter.value ? " ui-button--secondary ui-runtime-console__filter--active" : " ui-button--ghost"}`}
            type="button"
            aria-pressed={activeFilter === filter.value}
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="ui-runtime-console__empty">
          {logs.length === 0
            ? "Runtime logs will appear here."
            : `No ${FILTER_OPTIONS.find((filter) => filter.value === activeFilter)?.label.toLowerCase() ?? "matching"} logs right now.`}
        </div>
      ) : (
        <ul className="ui-runtime-console__logs ui-scrollbar">
          {filteredLogs.map((log) => {
            const hasExpandedDetails = Boolean(log.details || log.stack);

            return (
              <li key={log.id} className="ui-runtime-console__log-card">
                <div className="ui-runtime-console__log-meta">
                  <span className={`ui-runtime-console__health-badge ui-runtime-console__health-badge--${mapBadgeVariant(log.severity)}`}>
                    {log.severity}
                  </span>
                  <span className="ui-runtime-console__log-source">{presentLogSource(log.source)}</span>
                  <time className="ui-runtime-console__log-time" dateTime={log.timestamp} title={new Date(log.timestamp).toLocaleString()}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </time>
                </div>
                <div className="ui-runtime-console__log-message">{log.message}</div>
                {hasExpandedDetails ? (
                  <details className="ui-runtime-console__log-details">
                    <summary>{log.severity === "error" ? "Show error details" : "Show details"}</summary>
                    {log.details ? <div className="ui-runtime-console__log-detail-copy">{log.details}</div> : null}
                    {log.stack ? <pre className="ui-code-block ui-text-small ui-runtime-console__log-stack">{log.stack}</pre> : null}
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function filterRuntimeLogs(
  logs: ReadonlyArray<RuntimeConsoleLogEntry>,
  filter: RuntimeConsoleLogFilter,
): ReadonlyArray<RuntimeConsoleLogEntry> {
  if (filter === "all") {
    return logs;
  }

  return logs.filter((log) => log.severity === filter);
}

function mapBadgeVariant(severity: RuntimeConsoleLogEntry["severity"]): "healthy" | "degraded" | "offline" {
  switch (severity) {
    case "error":
      return "offline";
    case "warn":
      return "degraded";
    case "info":
    default:
      return "healthy";
  }
}

function presentLogSource(source: RuntimeConsoleLogEntry["source"]): string {
  return source.replaceAll("-", " ");
}
