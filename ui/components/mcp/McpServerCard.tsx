import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";

export interface McpServerCardProps {
  readonly server: McpServerDescriptor;
  readonly isSelected?: boolean;
  readonly isConfigured?: boolean;
  readonly isBusy?: boolean;
  readonly onSelect?: (serverId: string) => void;
  readonly onAdd?: (serverId: string) => void;
  readonly onConnect?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnect?: (serverId: string) => void;
}

export default function McpServerCard({
  server,
  isSelected,
  isConfigured,
  isBusy,
  onSelect,
  onAdd,
  onConnect,
  onDisconnect,
}: McpServerCardProps): JSX.Element {
  const isConnected = server.connected ?? server.status === "connected";
  const statusLabel = isConnected ? "Connected" : server.status === "connecting" ? "Connecting" : server.status === "error" ? "Needs attention" : "Disconnected";

  return (
    <article className={`ui-card ui-mcp-server-card${isSelected ? " ui-mcp-server-card--selected" : ""}`}>
      <div className="ui-card__body ui-stack ui-stack--sm">
        <button
          className="ui-mcp-server-card__button"
          type="button"
          onClick={() => onSelect?.(server.id)}
          aria-pressed={isSelected}
        >
          <div className="ui-row ui-row--between ui-row--wrap" style={{ alignItems: "flex-start", width: "100%" }}>
            <div className="ui-stack ui-stack--2xs" style={{ minWidth: 0 }}>
              <div className="ui-heading-4" style={{ overflowWrap: "anywhere" }}>{server.name}</div>
              <div className="ui-text-secondary ui-text-small">{describeTransport(server.transport)}</div>
            </div>
            <span className={`ui-badge ${badgeClassForStatus(server.status)}`}>{statusLabel}</span>
          </div>
        </button>

        <div className="ui-row ui-row--wrap">
          <span className="ui-badge ui-badge--neutral">{server.toolCount} tools</span>
          <span className="ui-badge ui-badge--neutral">{server.resourceCount} resources</span>
          {isConfigured ? <span className="ui-badge ui-badge--info">Configured</span> : <span className="ui-badge ui-badge--warning">Discoverable</span>}
        </div>

        <p className="ui-text-secondary ui-text-small ui-mcp-server-card__summary">
          {server.errorMessage?.trim() || defaultSummary(server, isConfigured)}
        </p>

        <div className="ui-row ui-row--wrap">
          {isConfigured ? (
            isConnected ? (
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
    </article>
  );
}

function describeTransport(transport: McpServerDescriptor["transport"]): string {
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

function badgeClassForStatus(status: McpServerDescriptor["status"]): string {
  switch (status) {
    case "connected":
      return "ui-badge--success";
    case "connecting":
      return "ui-badge--info";
    case "error":
      return "ui-badge--danger";
    default:
      return "ui-badge--neutral";
  }
}

function defaultSummary(server: McpServerDescriptor, isConfigured?: boolean): string {
  if (isConfigured) {
    return server.connected
      ? "Ready for this workspace."
      : "Saved in your workspace and ready when you want to connect.";
  }

  return `Discoverable ${describeTransport(server.transport).toLowerCase()} server you can add to this workspace.`;
}
