import type { McpServerDescriptor } from "../../../application/mcp/models/McpServerDescriptor";
import type { McpServerSearchCriteria } from "../../../application/mcp/models/McpServerSearchCriteria";
import type { McpServerStatus } from "../../../application/mcp/models/McpServerStatus";
import McpServerCard from "./McpServerCard";
import McpServerDetailsPanel from "./McpServerDetailsPanel";
import McpServerSearchBar from "./McpServerSearchBar";

export interface McpServerBrowserProps {
  readonly configuredServers: ReadonlyArray<McpServerDescriptor>;
  readonly discoveredServers: ReadonlyArray<McpServerDescriptor>;
  readonly selectedServer?: McpServerDescriptor;
  readonly selectedServerStatus?: McpServerStatus;
  readonly isLoadingConfigured?: boolean;
  readonly isSearching?: boolean;
  readonly isMutating?: boolean;
  readonly error?: string;
  readonly searchCriteria?: McpServerSearchCriteria;
  readonly onSearch: (criteria: McpServerSearchCriteria) => void;
  readonly onClearSearch?: () => void;
  readonly onSelectServer?: (serverId: string) => void;
  readonly onAddConfigured?: (serverId: string) => void;
  readonly onConnectServer?: (serverId: string, reconnect?: boolean) => void;
  readonly onDisconnectServer?: (serverId: string) => void;
}

export default function McpServerBrowser({
  configuredServers,
  discoveredServers,
  selectedServer,
  selectedServerStatus,
  isLoadingConfigured,
  isSearching,
  isMutating,
  error,
  searchCriteria,
  onSearch,
  onClearSearch,
  onSelectServer,
  onAddConfigured,
  onConnectServer,
  onDisconnectServer,
}: McpServerBrowserProps): JSX.Element {
  const configuredIds = new Set(configuredServers.map((server) => server.id));
  const discoverableServers = discoveredServers.filter((server) => !configuredIds.has(server.id));
  const selectedIsConfigured = selectedServer ? configuredIds.has(selectedServer.id) : false;

  return (
    <section className="ui-mcp-browser ui-stack ui-stack--md">
      <McpServerSearchBar
        value={searchCriteria}
        isBusy={isSearching || isMutating}
        onSearch={onSearch}
        onClear={onClearSearch}
      />

      {error ? (
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--xs">
            <span className="ui-badge ui-badge--danger">Attention needed</span>
            <p className="ui-text-secondary">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="ui-mcp-browser__grid">
        <section className="ui-panel ui-panel--elevated">
          <div className="ui-panel__header">
            <div>
              <div className="ui-panel__title">My MCP Servers</div>
              <div className="ui-panel__subtitle">Saved servers for this workspace.</div>
            </div>
            <span className="ui-text-small ui-text-secondary">
              {isLoadingConfigured ? "Loading…" : `${configuredServers.length} saved`}
            </span>
          </div>
          <div className="ui-panel__body ui-stack ui-stack--sm ui-scrollbar ui-mcp-browser__list">
            {configuredServers.length === 0 ? (
              <div className="ui-empty-state">
                <p className="ui-text-secondary">You have not saved any MCP servers yet.</p>
              </div>
            ) : (
              configuredServers.map((server) => (
                <McpServerCard
                  key={server.id}
                  server={server}
                  isConfigured={true}
                  isSelected={selectedServer?.id === server.id}
                  isBusy={isMutating}
                  onSelect={onSelectServer}
                  onConnect={onConnectServer}
                  onDisconnect={onDisconnectServer}
                />
              ))
            )}
          </div>
        </section>

        <section className="ui-panel ui-panel--elevated">
          <div className="ui-panel__header">
            <div>
              <div className="ui-panel__title">Discover MCP Servers</div>
              <div className="ui-panel__subtitle">Search known entries and discoverable remote servers.</div>
            </div>
            <span className="ui-text-small ui-text-secondary">
              {isSearching ? "Searching…" : `${discoverableServers.length} results`}
            </span>
          </div>
          <div className="ui-panel__body ui-stack ui-stack--sm ui-scrollbar ui-mcp-browser__list">
            {discoverableServers.length === 0 ? (
              <div className="ui-empty-state">
                <p className="ui-text-secondary">No discoverable servers match your search right now.</p>
              </div>
            ) : (
              discoverableServers.map((server) => (
                <McpServerCard
                  key={server.id}
                  server={server}
                  isConfigured={false}
                  isSelected={selectedServer?.id === server.id}
                  isBusy={isMutating}
                  onSelect={onSelectServer}
                  onAdd={onAddConfigured}
                />
              ))
            )}
          </div>
        </section>

        <McpServerDetailsPanel
          server={selectedServer}
          status={selectedServerStatus}
          isConfigured={selectedIsConfigured}
          isBusy={isMutating}
          onAdd={onAddConfigured}
          onConnect={onConnectServer}
          onDisconnect={onDisconnectServer}
        />
      </div>
    </section>
  );
}
