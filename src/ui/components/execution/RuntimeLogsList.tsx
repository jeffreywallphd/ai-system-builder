import {
  type RuntimeDiagnostics,
  type RuntimeLogVerbosity,
} from "@application/runtime/RuntimeDiagnostics";
import type { RuntimeConsoleLogEntry } from "../../state/RuntimeConsoleStore";

export type RuntimeConsoleLogFilter = "all" | "error" | "warn" | "info";

export interface RuntimeLogsListProps {
  readonly logs: ReadonlyArray<RuntimeConsoleLogEntry>;
  readonly activeFilter: RuntimeConsoleLogFilter;
  readonly logVerbosity: RuntimeLogVerbosity;
  readonly onFilterChange: (filter: RuntimeConsoleLogFilter) => void;
  readonly onLogVerbosityChange: (verbosity: RuntimeLogVerbosity) => void;
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

const VERBOSITY_OPTIONS: ReadonlyArray<{ value: RuntimeLogVerbosity; label: string }> = Object.freeze([
  { value: "normal", label: "Normal" },
  { value: "verbose", label: "Verbose" },
]);

export default function RuntimeLogsList({
  logs,
  activeFilter,
  logVerbosity,
  onFilterChange,
  onLogVerbosityChange,
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
          <label className="ui-runtime-console__verbosity-control">
            <span className="ui-runtime-console__verbosity-label">Verbosity</span>
            <select
              className="ui-input ui-runtime-console__verbosity-select"
              aria-label="Runtime log verbosity"
              value={logVerbosity}
              onChange={(event) => onLogVerbosityChange(event.target.value as RuntimeLogVerbosity)}
            >
              {VERBOSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
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
              {isRestartingRuntime ? "Restartingâ€¦" : "Restart runtime"}
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
          {filteredLogs.map((log) => (
            <li key={log.id} className="ui-runtime-console__log-card">
              <div className="ui-runtime-console__log-meta">
                <span className={`ui-runtime-console__health-badge ui-runtime-console__health-badge--${mapBadgeVariant(log.severity)}`}>
                  {log.severity}
                </span>
                <span className="ui-runtime-console__log-source">{presentLogSource(log.source)}</span>
                {log.requestMethod || log.target ? (
                  <span className="ui-runtime-console__log-request">
                    {[log.requestMethod, log.target].filter(Boolean).join(" ")}
                  </span>
                ) : null}
                <time className="ui-runtime-console__log-time" dateTime={log.timestamp} title={new Date(log.timestamp).toLocaleString()}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <div className="ui-runtime-console__log-message">{log.message}</div>
              {log.details ? <div className="ui-runtime-console__log-detail-copy">{log.details}</div> : null}
              {logVerbosity === "normal" && log.stackPreview ? (
                <pre className="ui-code-block ui-text-small ui-runtime-console__log-stack-preview">{log.stackPreview}</pre>
              ) : null}
              {logVerbosity === "verbose" ? renderVerboseDiagnostics(log.diagnostics, log.stack) : null}
            </li>
          ))}
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

function renderVerboseDiagnostics(diagnostics: RuntimeDiagnostics | undefined, stack: string | undefined): JSX.Element | null {
  if (!diagnostics && !stack) {
    return null;
  }

  return (
    <div className="ui-runtime-console__verbose-block">
      <div className="ui-runtime-console__verbose-title">Verbose diagnostics</div>
      {diagnostics ? (
        <dl className="ui-runtime-console__diagnostic-grid">
          {renderDiagnosticRow("Subsystem", diagnostics.subsystem)}
          {renderDiagnosticRow("Class", diagnostics.className)}
          {renderDiagnosticRow("Method", diagnostics.methodName)}
          {renderDiagnosticRow("Operation", diagnostics.operation)}
          {renderDiagnosticRow("Request", [diagnostics.requestMethod, diagnostics.target].filter(Boolean).join(" ") || undefined)}
          {renderDiagnosticRow(
            "Before response",
            diagnostics.failedBeforeResponse === undefined ? undefined : diagnostics.failedBeforeResponse ? "yes" : "no",
          )}
          {renderDiagnosticRow("Error name", diagnostics.name)}
          {renderDiagnosticRow("Cause", diagnostics.cause)}
        </dl>
      ) : null}
      {diagnostics?.causeChain?.length ? (
        <div className="ui-runtime-console__verbose-section">
          <div className="ui-runtime-console__verbose-label">Cause chain</div>
          <ol className="ui-runtime-console__cause-chain">
            {diagnostics.causeChain.map((cause, index) => (
              <li key={`${cause.message}-${index}`}>
                <strong>{cause.name ?? "Error"}:</strong> {cause.message}
                {cause.stack ? <pre className="ui-code-block ui-text-small ui-runtime-console__log-stack">{cause.stack}</pre> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {diagnostics?.details !== undefined ? (
        <div className="ui-runtime-console__verbose-section">
          <div className="ui-runtime-console__verbose-label">Details payload</div>
          <pre className="ui-code-block ui-text-small ui-runtime-console__log-stack">{stringifyStructuredValue(diagnostics.details)}</pre>
        </div>
      ) : null}
      {stack ? (
        <div className="ui-runtime-console__verbose-section">
          <div className="ui-runtime-console__verbose-label">Full stack trace</div>
          <pre className="ui-code-block ui-text-small ui-runtime-console__log-stack">{stack}</pre>
        </div>
      ) : null}
    </div>
  );
}

function renderDiagnosticRow(label: string, value: string | undefined): JSX.Element | null {
  if (!value) {
    return null;
  }

  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function stringifyStructuredValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
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

