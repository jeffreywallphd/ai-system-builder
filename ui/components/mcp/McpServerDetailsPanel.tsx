import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpServerStatus } from "../../../application/mcp/models/McpServerStatus";

export interface McpServerDetailsPanelProps {
  readonly server?: McpServerDescriptor;
  readonly status?: McpServerStatus;
  readonly isConfigured?: boolean;
  readonly isBusy?: boolean;
  readonly onAdd?: (serverId: string) => void;
  readonly onConnect?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnect?: (serverId: string) => void;
}

export default function McpServerDetailsPanel({
  server,
  status,
  isConfigured,
  isBusy,
  onAdd,
  onConnect,
  onDisconnect,
}: McpServerDetailsPanelProps): JSX.Element {
  if (!server) {
    return (
      <section className="ui-panel ui-panel--elevated ui-mcp-details-panel">
        <div className="ui-panel__header">
          <div>
            <div className="ui-panel__title">Server details</div>
            <div className="ui-panel__subtitle">Choose a server to review connection status and setup notes.</div>
          </div>
        </div>
        <div className="ui-panel__body ui-empty-state">
          <p className="ui-text-secondary">Select a server from either list to inspect it here.</p>
        </div>
      </section>
    );
  }

  const effectiveStatus = status?.state ?? server.status;
  const connected = status?.connected ?? server.connected ?? server.status === "connected";

  return (
    <section className="ui-panel ui-panel--elevated ui-mcp-details-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">{server.name}</div>
          <div className="ui-panel__subtitle">
            {isConfigured ? "Saved in My MCP Servers." : "Available to add to My MCP Servers."}
          </div>
        </div>
        <span className="ui-badge ui-badge--info">{friendlyState(effectiveStatus)}</span>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <span className="ui-text-small ui-text-secondary">Connection type</span>
            <strong>{friendlyTransport(server.transport)}</strong>
          </div>
          <div className="ui-meta-item">
            <span className="ui-text-small ui-text-secondary">Connection status</span>
            <strong>{connected ? "Connected" : "Disconnected"}</strong>
          </div>
          <div className="ui-meta-item">
            <span className="ui-text-small ui-text-secondary">Tools</span>
            <strong>{server.toolCount}</strong>
          </div>
          <div className="ui-meta-item">
            <span className="ui-text-small ui-text-secondary">Resources</span>
            <strong>{server.resourceCount}</strong>
          </div>
        </div>

        <p className="ui-text-secondary ui-text-small">
          {status?.errorMessage || server.errorMessage || (isConfigured
            ? "This server is saved for the current workspace."
            : "Add this server to keep it handy in the workspace.")}
        </p>

        {server.url ? (
          <div className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Address</span>
            <code className="ui-subtle" style={{ overflowWrap: "anywhere" }}>{server.url}</code>
          </div>
        ) : null}

        {server.command ? (
          <div className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Launch command</span>
            <code className="ui-subtle" style={{ overflowWrap: "anywhere" }}>
              {[server.command, ...(server.args ?? [])].join(" ")}
            </code>
          </div>
        ) : null}

        <div className="ui-row ui-row--wrap">
          {isConfigured ? (
            connected ? (
              <>
                <button className="ui-button ui-button--secondary ui-button--sm" type="button" disabled={isBusy} onClick={() => onDisconnect?.(server.id)}>
                  Disconnect
                </button>
                <button className="ui-button ui-button--ghost ui-button--sm" type="button" disabled={isBusy} onClick={() => onConnect?.(server.id, true)}>
                  Reconnect
                </button>
              </>
            ) : (
              <button className="ui-button ui-button--primary ui-button--sm" type="button" disabled={isBusy} onClick={() => onConnect?.(server.id, false)}>
                Connect
              </button>
            )
          ) : (
            <button className="ui-button ui-button--primary ui-button--sm" type="button" disabled={isBusy} onClick={() => onAdd?.(server.id)}>
              Add to My MCP Servers
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function friendlyTransport(transport: McpServerDescriptor["transport"]): string {
  switch (transport) {
    case "stdio":
      return "Local command";
    case "http":
      return "HTTP";
    case "sse":
      return "Server-sent events";
    case "inmemory":
      return "Built-in";
    default:
      return transport;
  }
}

function friendlyState(state: McpServerStatus["state"] | McpServerDescriptor["status"]): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "error":
      return "Needs attention";
    default:
      return "Disconnected";
  }
}
