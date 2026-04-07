import { useEffect, useState } from "react";
import McpLocalServerComposer from "../components/mcp/McpLocalServerComposer";
import PageTabs from "../components/navigation/PageTabs";
import ToolBrowser from "../components/tools/ToolBrowser";
import ToolSearchBar, { type ToolSearchBarValue } from "../components/tools/ToolSearchBar";
import { useUiDependencies } from "../composition/AppProviders";
import type { McpStoreState } from "../state/McpStore";
import type { ToolStoreState } from "../state/ToolStore";

type ToolsTabId = "find" | "create";

export default function ToolsPage(): JSX.Element {
  const { mcpStore, toolStore } = useUiDependencies();
  const [mcpState, setMcpState] = useState<McpStoreState>(mcpStore.getState());
  const [toolState, setToolState] = useState<ToolStoreState>(toolStore.getState());
  const [activeTab, setActiveTab] = useState<ToolsTabId>("find");

  useEffect(() => mcpStore.subscribe(setMcpState), [mcpStore]);
  useEffect(() => toolStore.subscribe(setToolState), [toolStore]);

  useEffect(() => {
    void mcpStore.initialize().catch(() => undefined);
    void toolStore.refreshTools().catch(() => undefined);
  }, [mcpStore, toolStore]);

  const runToolSearch = (value: ToolSearchBarValue): void => {
    void toolStore
      .refreshTools({
        query: value.query || undefined,
        typeIds: value.typeId ? [value.typeId] : undefined,
      })
      .catch(() => undefined);
  };

  return (
    <section className="ui-page ui-stack ui-stack--md">
      <div>
        <h1 className="ui-page__title">Tools</h1>
        <p className="ui-page__subtitle">
          Find ready-to-run tools for common tasks, or create a new workspace-local MCP tool from the built-in editor.
        </p>
        <p className="ui-muted">
          Search published tools by name or type, then switch to creation when you need something custom for your workspace.
        </p>
      </div>

      <PageTabs
        label="Tools tabs"
        tabs={[
          {
            id: "find",
            label: "Find Tools",
            description: "Search for saved or published tools.",
          },
          {
            id: "create",
            label: "Create Tool",
            description: "Build a new workspace-local MCP tool.",
          },
        ]}
        activeTabId={activeTab}
        onChange={(tabId) => setActiveTab(tabId as ToolsTabId)}
      />

      <section
        id="page-tabpanel-find"
        role="tabpanel"
        aria-labelledby="page-tab-find"
        className="ui-page-tab-panel"
        hidden={activeTab !== "find"}
      >
        <div className="ui-card">
          <div className="ui-card__body ui-stack ui-stack--md">
            <ToolSearchBar
              key={`${toolState.activeSearch?.query ?? ""}:${toolState.activeSearch?.typeIds?.[0] ?? ""}`}
              value={{
                query: toolState.activeSearch?.query ?? "",
                typeId: toolState.activeSearch?.typeIds?.[0],
              }}
              typeOptions={toolState.availableTypes}
              isBusy={toolState.isLoading}
              onSearch={runToolSearch}
              onClear={() => {
                void toolStore.refreshTools().catch(() => undefined);
              }}
            />

            {toolState.error ? (
              <div className="ui-banner ui-banner--danger">{toolState.error}</div>
            ) : null}

            {toolState.capabilitySearchResult?.candidates.length ? (
              <div className="ui-card">
                <div className="ui-card__body ui-stack ui-stack--xs">
                  <strong>Suggested capabilities</strong>
                  <p className="ui-text-secondary">
                    These related capabilities were discovered while searching for tools.
                  </p>
                  <div className="ui-chips">
                    {toolState.capabilitySearchResult.candidates.map((candidate) => (
                      <span key={candidate.id} className="ui-badge ui-badge--neutral">
                        {candidate.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <ToolBrowser tools={toolState.tools} />
          </div>
        </div>
      </section>

      <section
        id="page-tabpanel-create"
        role="tabpanel"
        aria-labelledby="page-tab-create"
        className="ui-page-tab-panel"
        hidden={activeTab !== "create"}
      >
        <McpLocalServerComposer
          draft={mcpState.authoringDraft}
          agentPrompt={mcpState.authoringPrompt}
          isBusy={mcpState.isMutating}
          isGenerating={mcpState.isGeneratingDraft}
          onDraftChange={(patch) => mcpStore.updateAuthoringDraft(patch)}
          onAgentPromptChange={(value) => mcpStore.setAuthoringPrompt(value)}
          onGenerateDraft={() => {
            void mcpStore.generateAuthoringDraft().catch(() => undefined);
          }}
          onCreateServer={() => {
            void mcpStore.createLocalServer().catch(() => undefined);
          }}
        />
      </section>
    </section>
  );
}
