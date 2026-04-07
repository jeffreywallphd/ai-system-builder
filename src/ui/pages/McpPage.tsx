import { useEffect, useState } from "react";
import type { ExecutionRunProjection } from "../../application/execution/ExecutionRunProjectionService";
import ExecutionHistoryPanel from "../components/execution/ExecutionHistoryPanel";
import McpLocalServerComposer from "../components/mcp/McpLocalServerComposer";
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
  authoringDraft: Object.freeze({
    serverId: "workspace-helper",
    serverName: "Workspace Helper",
    toolName: "process_payload",
    code: "return {}",
  }),
  authoringPrompt: "",
  isLoadingConfigured: false,
  isSearching: false,
  isMutating: false,
  isLoadingTools: false,
  isGeneratingDraft: false,
  error: undefined,
});

export default function McpPage(): JSX.Element {
  const { mcpStore, executionHistoryService } = useUiDependencies();
  const [state, setState] = useState<McpStoreState>(() => mcpStore.getState() || fallbackState);
  const [executionHistory, setExecutionHistory] = useState<ReadonlyArray<ExecutionRunProjection>>([]);

  useEffect(() => mcpStore.subscribe(setState), [mcpStore]);

  useEffect(() => {
    void mcpStore.initialize().catch(() => undefined);
  }, [mcpStore]);

  useEffect(() => {
    const metadata = state.selectedServerId
      ? { serverId: state.selectedServerId }
      : undefined;
    void executionHistoryService.listHistory({
      executionKind: "mcp-server-operation",
      metadata,
      limit: 8,
    }).then(setExecutionHistory).catch(() => setExecutionHistory([]));
  }, [executionHistoryService, state.isMutating, state.selectedServerId, state.selectedServerStatus?.checkedAt]);

  return (
    <section className="ui-page ui-stack ui-stack--md">
      <div className="ui-page__hero">
        <div className="ui-page__hero-copy">
          <h1 className="ui-page__title">MCP</h1>
          <p className="ui-page__subtitle">
            Create new local MCP servers, then start, stop, and restart every controlled server from one workspace management surface.
          </p>
        </div>
      </div>

      <McpLocalServerComposer
        compact={true}
        draft={state.authoringDraft}
        agentPrompt={state.authoringPrompt}
        isBusy={state.isMutating}
        onDraftChange={(patch) => mcpStore.updateAuthoringDraft(patch)}
        onAgentPromptChange={(value) => mcpStore.setAuthoringPrompt(value)}
        onCreateServer={() => {
          void mcpStore.createLocalServer().catch(() => undefined);
        }}
      />

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

      <ExecutionHistoryPanel
        title="MCP server operation history"
        subtitle="Durable unified-execution records for local MCP server provisioning and server lifecycle actions."
        items={executionHistory}
        emptyMessage="No MCP server operations have been recorded yet."
        executionHistoryService={executionHistoryService}
      />
    </section>
  );
}
