import { useEffect, useState } from "react";
import McpServerBrowser from "../components/mcp/McpServerBrowser";
import { useUiDependencies } from "../composition/AppProviders";
import type { McpStoreState } from "../state/McpStore";

const fallbackState: McpStoreState = Object.freeze({
  runtimeStatus: undefined,
  configuredServers: Object.freeze([]),
  discoveredServers: Object.freeze([]),
  selectedServerId: undefined,
  selectedServerStatus: undefined,
  selectedServerTools: Object.freeze([]),
  selectedToolId: undefined,
  selectedToolDescriptor: undefined,
  toolSearchQuery: "",
  searchCriteria: undefined,
  searchQuery: "",
  isLoadingConfigured: false,
  isSearching: false,
  isMutating: false,
  isLoadingTools: false,
  error: undefined,
});

export default function McpPage(): JSX.Element {
  const { mcpStore } = useUiDependencies();
  const [state, setState] = useState<McpStoreState>(() => mcpStore.getState() || fallbackState);

  useEffect(() => mcpStore.subscribe(setState), [mcpStore]);

  useEffect(() => {
    void mcpStore.initialize().catch(() => undefined);
  }, [mcpStore]);

  return (
    <section className="ui-page">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">MCP</h1>
          <p className="ui-page__subtitle">
            Manage your MCP servers, check connection status, and save helpful server entries for this workspace.
          </p>
        </div>
      </div>

      <McpServerBrowser
        configuredServers={state.configuredServers}
        discoveredServers={state.discoveredServers}
        selectedServer={mcpStore.getSelectedServer()}
        selectedServerStatus={state.selectedServerStatus}
        selectedServerTools={state.selectedServerTools}
        selectedToolId={state.selectedToolId}
        selectedTool={state.selectedToolDescriptor}
        toolSearchQuery={state.toolSearchQuery}
        isLoadingConfigured={state.isLoadingConfigured}
        isSearching={state.isSearching}
        isMutating={state.isMutating}
        isLoadingTools={state.isLoadingTools}
        error={state.error}
        searchCriteria={state.searchCriteria}
        onSearch={(criteria) => {
          void mcpStore.search(criteria).catch(() => undefined);
        }}
        onClearSearch={() => {
          void mcpStore.search({}).catch(() => undefined);
        }}
        onSelectServer={(serverId) => mcpStore.selectServer(serverId)}
        onAddConfigured={(serverId) => {
          void mcpStore.addConfiguredServer(serverId).catch(() => undefined);
        }}
        onConnectServer={(serverId, reconnect) => {
          void mcpStore.connect(serverId, reconnect).catch(() => undefined);
        }}
        onDisconnectServer={(serverId) => {
          void mcpStore.disconnect(serverId).catch(() => undefined);
        }}
        onToolSearch={(query) => {
          void mcpStore.searchTools(query).catch(() => undefined);
        }}
        onSelectTool={(toolId) => {
          void mcpStore.selectTool(toolId).catch(() => undefined);
        }}
      />
    </section>
  );
}
