import type { RuntimeAppState } from "../../state/RuntimeConsoleStore";
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
  readonly runtimeAppState?: RuntimeAppState;
  readonly runtimeAppStateDetail?: string;
  readonly isRuntimeUnavailable?: boolean;
  readonly onSearchChange?: (value: string) => void;
  readonly onConnectServer?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnectServer?: (serverId: string) => void;
  readonly onRestartRuntime?: () => void;
}

export default function McpRuntimeStatusPanel({
  status,
  tools,
  servers,
  searchQuery = "",
  isLoading = false,
  error,
  runtimeAppState = "ready",
  runtimeAppStateDetail,
  isRuntimeUnavailable = false,
  onSearchChange,
  onConnectServer,
  onDisconnectServer,
  onRestartRuntime,
}: McpRuntimeStatusPanelProps): JSX.Element {
  const toolNames = tools.slice(0, 5).map((tool) => tool.title || tool.name);
  const isInteractionDisabled = isLoading || isRuntimeUnavailable;

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
            <div className="ui-meta-label">Python runtime</div>
            <div className="ui-meta-value">{status?.pythonRuntimeHealthy === false ? "Unhealthy" : "Healthy"}</div>
          </div>
          <div className="ui-meta-item">
            <div className="ui-meta-label">MCP runtime</div>
            <div className="ui-meta-value">{status?.mcpRuntimeHealthy === true ? "Healthy" : status?.enabled ? "Degraded" : status ? "Disabled" : "—"}</div>
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
            disabled={isInteractionDisabled}
          />
        </label>

        {error ? <p className="ui-muted">{error}</p> : null}
        {isLoading ? <p className="ui-muted">Refreshing MCP tools and server status…</p> : null}
        {runtimeAppState !== "ready" ? (
          <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.75rem" }}>
            <p className="ui-muted" style={{ margin: 0 }}>
              {runtimeAppStateDetail ?? `Runtime is ${runtimeAppState}; MCP features will reconnect automatically when it becomes available.`}
            </p>
            {onRestartRuntime ? (
              <button
                className="ui-button ui-button--secondary"
                type="button"
                disabled={isLoading || runtimeAppState === "starting" || runtimeAppState === "reconnecting"}
                onClick={() => onRestartRuntime()}
              >
                Restart runtime
              </button>
            ) : null}
          </div>
        ) : null}
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
                      {server.id} · {server.transport} · {(server.sourceType ?? "external-remote")} · {server.toolCount} tools · {server.resourceCount} resources
                    </div>
                  </div>
                  <span className="ui-badge ui-badge--info">{server.status}</span>
                </div>
                <div className="ui-panel__body">
                  {server.errorMessage ? <p className="ui-muted">{server.errorMessage}</p> : null}
                  <p className="ui-muted">Config: {server.configValid === false ? "invalid" : "valid"} · Session: {server.sessionState ?? server.status} · Last sync: {server.lastSyncAt ?? "never"}</p>
                  <div className="ui-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                    <button className="ui-button ui-button--secondary" type="button" onClick={() => onConnectServer?.(server.id, false)} disabled={isInteractionDisabled}>
                      Connect
                    </button>
                    <button className="ui-button ui-button--ghost" type="button" onClick={() => onConnectServer?.(server.id, true)} disabled={isInteractionDisabled}>
                      Reconnect
                    </button>
                    <button
                      className="ui-button ui-button--ghost"
                      type="button"
                      onClick={() => onDisconnectServer?.(server.id)}
                      disabled={!isConnected || isInteractionDisabled}
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
