import type { McpConnectionStatus } from "../../../application/mcp/models/McpConnectionStatus";
import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpToolDescriptor } from "../../../application/mcp/models/McpToolDescriptor";

export interface McpRuntimeStatusPanelProps {
  readonly status?: McpConnectionStatus;
  readonly tools: ReadonlyArray<McpToolDescriptor>;
  readonly servers: ReadonlyArray<McpServerDescriptor>;
  readonly searchQuery?: string;
  readonly isLoading?: boolean;
  readonly error?: string;
  readonly onSearchChange?: (value: string) => void;
  readonly onConnectServer?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnectServer?: (serverId: string) => void;
}

export default function McpRuntimeStatusPanel({
  status,
  tools,
  servers,
  searchQuery = "",
  isLoading = false,
  error,
  onSearchChange,
  onConnectServer,
  onDisconnectServer,
}: McpRuntimeStatusPanelProps): JSX.Element {
  const toolNames = tools.slice(0, 5).map((tool) => tool.title || tool.name);

  return (
    <section className="ui-panel ui-panel--elevated" aria-live="polite">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">MCP Runtime</div>
          <div className="ui-panel__subtitle">
            Availability, configured server status, and discovered tools from the Python-backed MCP runtime.
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
            <div className="ui-meta-value">{servers.length || status?.servers.length || 0}</div>
          </div>
        </div>

        <label className="ui-field" htmlFor="mcp-server-search">
          <span className="ui-field__label">Search configured MCP servers</span>
          <input
            id="mcp-server-search"
            className="ui-input"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="Filter by id, name, transport, or metadata"
          />
        </label>

        {error ? <p className="ui-muted">{error}</p> : null}
        {isLoading ? <p className="ui-muted">Refreshing MCP tools and server status…</p> : null}
        {!isLoading && toolNames.length > 0 ? (
          <p className="ui-muted">Available tools: {toolNames.join(", ")}</p>
        ) : null}
        {!isLoading && toolNames.length === 0 && !error ? (
          <p className="ui-muted">No MCP tools discovered yet.</p>
        ) : null}

        <div className="ui-stack" style={{ gap: "0.75rem", marginTop: "1rem" }}>
          {servers.map((server) => {
            const isConnected = server.status === "connected";
            return (
              <article key={server.id} className="ui-panel" data-testid={`mcp-server-${server.id}`}>
                <div className="ui-panel__header">
                  <div>
                    <div className="ui-panel__title">{server.name}</div>
                    <div className="ui-panel__subtitle">
                      {server.id} · {server.transport} · {server.toolCount} tools · {server.resourceCount} resources
                    </div>
                  </div>
                  <span className="ui-badge ui-badge--info">{server.status}</span>
                </div>
                <div className="ui-panel__body">
                  {server.errorMessage ? <p className="ui-muted">{server.errorMessage}</p> : null}
                  <div className="ui-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button className="ui-button ui-button--secondary" type="button" onClick={() => onConnectServer?.(server.id, false)}>
                      Connect
                    </button>
                    <button className="ui-button ui-button--ghost" type="button" onClick={() => onConnectServer?.(server.id, true)}>
                      Reconnect
                    </button>
                    <button
                      className="ui-button ui-button--ghost"
                      type="button"
                      onClick={() => onDisconnectServer?.(server.id)}
                      disabled={!isConnected}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!isLoading && servers.length === 0 && !error ? (
            <p className="ui-muted">No configured MCP servers matched your search.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
