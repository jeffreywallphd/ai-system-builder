import type { AgentSessionDetailReadModel } from "@application/agents/contracts/AgentRunContracts";

interface SessionTransitionHistoryPanelProps {
  readonly session: AgentSessionDetailReadModel;
}

export function SessionTransitionHistoryPanel(props: SessionTransitionHistoryPanelProps): JSX.Element {
  return (
    <section className="ui-stack ui-stack--xs" aria-label="Transition history">
      <h4 className="ui-heading-4">Transition history</h4>
      {props.session.transitionHistory.length === 0 ? (
        <p className="ui-text-secondary">No transition records were persisted.</p>
      ) : (
        <ul className="ui-stack ui-stack--xs">
          {props.session.transitionHistory.map((entry, index) => (
            <li key={`${entry.status}-${entry.recordedAt}-${index}`} className="ui-text-secondary">
              {entry.recordedAt}: {entry.status}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

