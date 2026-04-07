import type { AgentAuthoringApiReadModel } from "@infrastructure/api/agents/AgentAuthoringBackendApi";

interface AgentListPanelProps {
  readonly agents: ReadonlyArray<AgentAuthoringApiReadModel>;
  readonly selectedAgentId: string;
  readonly isBusy: boolean;
  readonly onRefresh: () => void;
  readonly onSelectAgent: (agentId: string) => void;
  readonly onCreateAgent: () => void;
}

export function AgentListPanel(props: AgentListPanelProps): JSX.Element {
  return (
    <aside className="ui-card ui-stack ui-stack--sm" data-testid="agent-list-panel">
      <div className="ui-row ui-row--between">
        <h2 className="ui-heading-2">Agents</h2>
        <button className="ui-button ui-button--secondary ui-button--sm" onClick={props.onRefresh} disabled={props.isBusy}>Refresh</button>
      </div>
      <button className="ui-button ui-button--primary ui-button--sm" onClick={props.onCreateAgent} disabled={props.isBusy}>Create agent</button>
      <ul className="ui-stack ui-stack--xs">
        {props.agents.map((entry) => (
          <li key={entry.agent.id}>
            <button
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => props.onSelectAgent(entry.agent.id)}
              disabled={props.isBusy}
              aria-pressed={props.selectedAgentId === entry.agent.id}
            >
              {entry.agent.name} ({entry.agent.id})
            </button>
            <div className="ui-text-small ui-text-secondary">
              {entry.taxonomy.structuralKind}/{entry.taxonomy.semanticRole}/{entry.taxonomy.behaviorKind}
              {entry.contract ? ` Â· ${entry.contract.id}@${entry.contract.version}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

