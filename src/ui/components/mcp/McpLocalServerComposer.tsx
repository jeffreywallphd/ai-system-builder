import type { LocalMcpToolDraft } from "@application/mcp/models/LocalMcpToolDraft";

export interface McpLocalServerComposerProps {
  readonly draft: LocalMcpToolDraft;
  readonly agentPrompt: string;
  readonly isBusy?: boolean;
  readonly isGenerating?: boolean;
  readonly onDraftChange?: (patch: Partial<LocalMcpToolDraft>) => void;
  readonly onAgentPromptChange?: (value: string) => void;
  readonly onGenerateDraft?: () => void;
  readonly onCreateServer?: () => void;
  readonly compact?: boolean;
}

export default function McpLocalServerComposer({
  draft,
  agentPrompt,
  isBusy,
  isGenerating,
  onDraftChange,
  onAgentPromptChange,
  onGenerateDraft,
  onCreateServer,
  compact = false,
}: McpLocalServerComposerProps): JSX.Element {
  const title = compact ? "Create a local server" : "Author a workspace-local MCP tool";
  const subtitle = compact
    ? "Provision a controlled stdio server that can be started, stopped, or restarted from this workspace."
    : "Create a local MCP server, edit tool logic in a simple code editor, or ask the built-in coding agent for a starter implementation.";

  return (
    <section className="ui-panel ui-panel--elevated ui-mcp-authoring-panel">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">{title}</div>
          <div className="ui-panel__subtitle">{subtitle}</div>
        </div>
        <span className="ui-badge ui-badge--info">Workspace local</span>
      </div>

      <div className="ui-panel__body ui-stack ui-stack--md">
        <div className="ui-mcp-authoring-grid">
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Server id</span>
            <input className="ui-input" value={draft.serverId} onChange={(event) => onDraftChange?.({ serverId: event.currentTarget.value })} placeholder="docs-helper" />
          </label>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Server name</span>
            <input className="ui-input" value={draft.serverName} onChange={(event) => onDraftChange?.({ serverName: event.currentTarget.value })} placeholder="Docs Helper" />
          </label>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Tool name</span>
            <input className="ui-input" value={draft.toolName} onChange={(event) => onDraftChange?.({ toolName: event.currentTarget.value })} placeholder="search_docs" />
          </label>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Tool title</span>
            <input className="ui-input" value={draft.toolTitle ?? ""} onChange={(event) => onDraftChange?.({ toolTitle: event.currentTarget.value })} placeholder="Search Docs" />
          </label>
        </div>

        <label className="ui-stack ui-stack--2xs">
          <span className="ui-text-small ui-text-secondary">Description</span>
          <textarea className="ui-input ui-mcp-authoring-textarea" value={draft.toolDescription ?? draft.serverDescription ?? ""} onChange={(event) => onDraftChange?.({ toolDescription: event.currentTarget.value, serverDescription: event.currentTarget.value })} placeholder="Describe what the tool should do for operators." />
        </label>

        <div className="ui-mcp-authoring-grid">
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Input schema (JSON)</span>
            <textarea
              className="ui-input ui-mcp-authoring-textarea"
              value={JSON.stringify(draft.inputSchema ?? defaultInputSchema, null, 2)}
              onChange={(event) => onDraftChange?.({ inputSchema: parseJsonRecord(event.currentTarget.value) })}
            />
          </label>
          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small ui-text-secondary">Output schema (JSON)</span>
            <textarea
              className="ui-input ui-mcp-authoring-textarea"
              value={JSON.stringify(draft.outputSchema ?? defaultOutputSchema, null, 2)}
              onChange={(event) => onDraftChange?.({ outputSchema: parseJsonRecord(event.currentTarget.value) })}
            />
          </label>
        </div>

        {!compact ? (
          <div className="ui-card">
            <div className="ui-card__body ui-stack ui-stack--sm">
              <div className="ui-row ui-row--between ui-row--wrap" style={{ alignItems: "center" }}>
                <div>
                  <strong>AI coding agent</strong>
                  <div className="ui-text-small ui-text-secondary">Describe the tool you want and the agent will draft starter logic into the editor.</div>
                </div>
                <button className="ui-button ui-button--secondary ui-button--sm" type="button" disabled={isBusy || isGenerating} onClick={onGenerateDraft}>
                  {isGenerating ? "Draftingâ€¦" : "Ask coding agent"}
                </button>
              </div>
              <textarea className="ui-input ui-mcp-authoring-textarea" value={agentPrompt} onChange={(event) => onAgentPromptChange?.(event.currentTarget.value)} placeholder="Example: Create a tool that summarizes pasted release notes into three bullet points and a risk list." />
            </div>
          </div>
        ) : null}

        <label className="ui-stack ui-stack--2xs">
          <span className="ui-text-small ui-text-secondary">Tool logic editor</span>
          <textarea
            className="ui-input ui-mcp-authoring-editor"
            spellCheck={false}
            value={draft.code}
            onChange={(event) => onDraftChange?.({ code: event.currentTarget.value })}
            placeholder={'return {"summary": payload.get("input", "") }'}
          />
          <span className="ui-text-small ui-text-secondary">
            The runtime injects a <code>payload</code> dictionary. Return JSON-serializable data from this function body.
          </span>
        </label>

        <div className="ui-row ui-row--wrap">
          <button className="ui-button ui-button--primary" type="button" disabled={isBusy} onClick={onCreateServer}>
            {isBusy ? "Savingâ€¦" : "Create local server"}
          </button>
        </div>
      </div>
    </section>
  );
}

const defaultInputSchema = Object.freeze({
  type: "object",
  properties: {
    input: { type: "string" },
    options: { type: "object", additionalProperties: true },
  },
  additionalProperties: true,
});

const defaultOutputSchema = Object.freeze({
  type: "object",
  properties: {
    summary: { type: "string" },
    data: { type: "object", additionalProperties: true },
  },
  additionalProperties: true,
});

function parseJsonRecord(value: string): Readonly<Record<string, unknown>> | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

