import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpToolDescriptor } from "../../../application/mcp/models/McpToolDescriptor";

export interface McpRuntimeStatusPanelProps {
  readonly status?: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly isLoading?: boolean;
  readonly error?: string;
}

export default function McpRuntimeStatusPanel({
  status,
  tools,
  isLoading = false,
  error,
}: McpRuntimeStatusPanelProps): JSX.Element {
  const toolNames = tools.slice(0, 5).map((tool) => tool.title || tool.name);

  return (
    <section className="ui-panel ui-panel--elevated" aria-live="polite">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">MCP Runtime</div>
          <div className="ui-panel__subtitle">
            Availability and discovered tools from the Python-backed MCP runtime.
          </div>
        </div>
        <span className="ui-badge ui-badge--info">{status?.state ?? (isLoading ? "loading" : "unknown")}</span>
      </div>

      <div className="ui-panel__body">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Availability</div>
            <div className="ui-meta-value">{status?.enabled ? "Available" : status ? "Disabled" : "—"}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Discovered tools</div>
            <div className="ui-meta-value">{tools.length}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">Servers</div>
            <div className="ui-meta-value">{status?.servers.length ?? 0}</div>
          </div>
        </div>

        {error ? <p className="ui-muted">{error}</p> : null}
        {isLoading ? <p className="ui-muted">Refreshing MCP tools…</p> : null}
        {!isLoading && toolNames.length > 0 ? (
          <p className="ui-muted">Available tools: {toolNames.join(", ")}</p>
        ) : null}
        {!isLoading && toolNames.length === 0 && !error ? (
          <p className="ui-muted">No MCP tools discovered yet.</p>
        ) : null}
      </div>
    </section>
  );
}
