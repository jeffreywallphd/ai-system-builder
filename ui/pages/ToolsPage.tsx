import { useEffect, useState } from "react";
import McpLocalServerComposer from "../components/mcp/McpLocalServerComposer";
import McpServerDetailsPanel from "../components/mcp/McpServerDetailsPanel";
import { useUiDependencies } from "../composition/AppProviders";
import type { McpStoreState } from "../state/McpStore";

export default function ToolsPage(): JSX.Element {
  const { mcpStore } = useUiDependencies();
  const [state, setState] = useState<McpStoreState>(mcpStore.getState());

  useEffect(() => mcpStore.subscribe(setState), [mcpStore]);
  useEffect(() => {
    void mcpStore.initialize().catch(() => undefined);
  }, [mcpStore]);

  const selectedServer = mcpStore.getSelectedServer();

  return (
    <section className="ui-page ui-stack ui-stack--md">
      <div>
        <h1 className="ui-page__title">MCP Tools</h1>
        <p className="ui-page__subtitle">
          Browse MCP-backed tools, inspect their normalized descriptors, and publish new workspace-local tools through an editor-first authoring flow.
        </p>
        <p className="ui-muted">Ask coding agent to scaffold tool logic, then refine it in the embedded code editor before provisioning the server.</p>
        <p className="ui-muted">
          {state.selectedServerTools.length} tool{state.selectedServerTools.length === 1 ? "" : "s"} visible for {selectedServer?.name ?? "the selected MCP server"}.
        </p>
      </div>

      <div className="ui-mcp-browser__grid">
        <McpLocalServerComposer
          draft={state.authoringDraft}
          agentPrompt={state.authoringPrompt}
          isBusy={state.isMutating}
          isGenerating={state.isGeneratingDraft}
          onDraftChange={(patch) => mcpStore.updateAuthoringDraft(patch)}
          onAgentPromptChange={(value) => mcpStore.setAuthoringPrompt(value)}
          onGenerateDraft={() => {
            void mcpStore.generateAuthoringDraft().catch(() => undefined);
          }}
          onCreateServer={() => {
            void mcpStore.createLocalServer().catch(() => undefined);
          }}
        />
        <McpServerDetailsPanel
          server={selectedServer}
          status={state.selectedServerStatus}
          tools={state.selectedServerTools}
          selectedToolId={state.selectedToolId}
          selectedTool={state.selectedToolDescriptor}
          toolSearchQuery={state.toolSearchQuery}
          isConfigured={Boolean(selectedServer)}
          isBusy={state.isMutating}
          isLoadingTools={state.isLoadingTools}
          onToolSearch={(query) => {
            void mcpStore.searchTools(query).catch(() => undefined);
          }}
          onSelectTool={(toolId) => {
            void mcpStore.selectTool(toolId).catch(() => undefined);
          }}
          onConnect={(serverId, reconnect) => {
            void mcpStore.connect(serverId, reconnect).catch(() => undefined);
          }}
          onDisconnect={(serverId) => {
            void mcpStore.disconnect(serverId).catch(() => undefined);
          }}
        />
      </div>
    </section>
  );
}
