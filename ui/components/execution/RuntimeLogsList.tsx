import type { RuntimeConsoleLogEntry } from "../../state/RuntimeConsoleStore";

export interface RuntimeLogsListProps {
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
}

export default function RuntimeLogsList({ logs }: RuntimeLogsListProps): JSX.Element {
  return (
    <section className="ui-runtime-console__health" aria-live="polite">
      <div className="ui-runtime-console__health-header">
        <div>
          <div className="ui-runtime-console__health-title">Runtime logs</div>
          <div className="ui-runtime-console__health-subtitle">
            Consolidated runtime, network, MCP, and UI diagnostics retained for mobile troubleshooting.
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="ui-runtime-console__empty">Runtime logs will appear here.</div>
      ) : (
        <ul className="ui-runtime-console__health-list ui-scrollbar">
          {logs.map((log) => (
            <li key={log.id} className="ui-runtime-console__health-item">
              <span className={`ui-runtime-console__health-badge ui-runtime-console__health-badge--${mapBadgeVariant(log.severity)}`}>
                {log.severity}
              </span>
              <div className="ui-runtime-console__health-copy">
                <div className="ui-runtime-console__health-label">{log.source}</div>
                <div className="ui-runtime-console__health-detail">{log.message}</div>
                {log.details ? <div className="ui-text-secondary ui-text-small">{log.details}</div> : null}
                {log.stack ? <pre className="ui-code-block ui-text-small">{log.stack}</pre> : null}
              </div>
              <time className="ui-runtime-console__health-time" dateTime={log.timestamp}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
