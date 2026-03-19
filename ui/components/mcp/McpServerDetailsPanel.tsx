import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpServerStatus } from "../../../application/mcp/models/McpServerStatus";
import type { McpToolDescriptor } from "../../../application/mcp/models/McpToolDescriptor";

export interface McpServerDetailsPanelProps {
  readonly server?: McpServerDescriptor;
  readonly status?: McpServerStatus;
  readonly tools?: ReadonlyArray<McpToolDescriptor>;
  readonly selectedToolId?: string;
  readonly selectedTool?: McpToolDescriptor;
  readonly toolSearchQuery?: string;
  readonly isConfigured?: boolean;
  readonly isBusy?: boolean;
  readonly isLoadingTools?: boolean;
  readonly onToolSearch?: (query: string) => void;
  readonly onSelectTool?: (toolId: string) => void;
  readonly onAdd?: (serverId: string) => void;
  readonly onConnect?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnect?: (serverId: string) => void;
}

export default function McpServerDetailsPanel({
  server,
  status,
  tools = [],
  selectedToolId,
  selectedTool,
  toolSearchQuery,
  isConfigured,
  isBusy,
  isLoadingTools,
  onToolSearch,
  onSelectTool,
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
            <div className="ui-panel__subtitle">Choose a server to review connection status, available tools, and setup notes.</div>
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
  const activeTool = selectedTool ?? tools.find((tool) => tool.id === selectedToolId) ?? tools[0];

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

        <div className="ui-stack ui-stack--sm">
          <div className="ui-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="ui-panel__title" style={{ fontSize: "1rem" }}>Available tools</div>
              <div className="ui-text-small ui-text-secondary">Inspect normalized MCP tool descriptors for this server.</div>
            </div>
            <span className="ui-text-small ui-text-secondary">{isLoadingTools ? "Loading…" : `${tools.length} shown`}</span>
          </div>

          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Filter tools</span>
            <input
              className="ui-input"
              type="search"
              value={toolSearchQuery ?? ""}
              placeholder="Search names, tags, or arguments"
              onChange={(event) => onToolSearch?.(event.currentTarget.value)}
            />
          </label>

          {tools.length === 0 ? (
            <div className="ui-empty-state">
              <p className="ui-text-secondary">No MCP tools match this server and filter yet.</p>
            </div>
          ) : (
            <div className="ui-stack ui-stack--xs">
              {tools.map((tool) => {
                const isSelected = tool.id === activeTool?.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className="ui-card"
                    style={{
                      textAlign: "left",
                      borderColor: isSelected ? "var(--ui-accent, #6d5efc)" : undefined,
                    }}
                    onClick={() => onSelectTool?.(tool.id)}
                  >
                    <div className="ui-card__body ui-stack ui-stack--2xs">
                      <strong>{tool.title ?? tool.name}</strong>
                      <span className="ui-text-small ui-text-secondary">{tool.description ?? "No description provided yet."}</span>
                      <span className="ui-text-small ui-text-secondary">
                        {tool.arguments.length} argument{tool.arguments.length === 1 ? "" : "s"}
                        {tool.tags.length > 0 ? ` · ${tool.tags.join(", ")}` : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTool ? (
            <div className="ui-card">
              <div className="ui-card__body ui-stack ui-stack--sm">
                <div>
                  <div className="ui-panel__title" style={{ fontSize: "1rem" }}>{activeTool.title ?? activeTool.name}</div>
                  <div className="ui-text-small ui-text-secondary">Tool id: {activeTool.id}</div>
                </div>
                <p className="ui-text-secondary ui-text-small">{activeTool.description ?? "No tool description is available yet."}</p>
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-text-small ui-text-secondary">Unified capability mapping</span>
                  <code className="ui-subtle" style={{ overflowWrap: "anywhere" }}>
                    capabilityId={activeTool.id}
                  </code>
                  <span className="ui-text-small ui-text-secondary">
                    Routed as MCP Tools / python-mcp-runtime using server <strong>{activeTool.serverId}</strong> and tool <strong>{activeTool.name}</strong>.
                  </span>
                </div>
                {activeTool.categories.length > 0 ? (
                  <div className="ui-stack ui-stack--2xs">
                    <span className="ui-text-small ui-text-secondary">Categories</span>
                    <div className="ui-row ui-row--wrap">
                      {activeTool.categories.map((category) => (
                        <span key={category} className="ui-badge ui-badge--neutral">{category}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-text-small ui-text-secondary">Arguments</span>
                  {activeTool.arguments.length === 0 ? (
                    <p className="ui-text-small ui-text-secondary">This tool currently exposes no explicit arguments.</p>
                  ) : (
                    <div className="ui-stack ui-stack--xs">
                      {activeTool.arguments.map((argument) => (
                        <div key={argument.name} className="ui-card">
                          <div className="ui-card__body ui-stack ui-stack--2xs">
                            <div className="ui-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                              <strong>{argument.name}</strong>
                              <span className="ui-text-small ui-text-secondary">{argument.type}{argument.required ? " · required" : " · optional"}</span>
                            </div>
                            {argument.description ? <span className="ui-text-small ui-text-secondary">{argument.description}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ui-stack ui-stack--2xs">
                  <span className="ui-text-small ui-text-secondary">Input schema</span>
                  <pre className="ui-subtle" style={{ margin: 0, overflowX: "auto" }}>
                    {JSON.stringify(activeTool.inputSchema, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
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
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
    case "ready":
      return "Ready";
    case "disabled":
      return "Disabled";
    default:
      return state;
  }
}
