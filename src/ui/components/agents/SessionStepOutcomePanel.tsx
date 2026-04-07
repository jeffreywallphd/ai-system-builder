import type { AgentSessionDetailReadModel } from "../../../application/agents/contracts/AgentRunContracts";

interface SessionStepOutcomePanelProps {
  readonly session: AgentSessionDetailReadModel;
}

export function SessionStepOutcomePanel(props: SessionStepOutcomePanelProps): JSX.Element {
  const outcomes = props.session.operational.stepOutcomes;
  return (
    <section className="ui-stack ui-stack--xs" aria-label="Step outcomes">
      <h4 className="ui-heading-4">Step outcomes</h4>
      {outcomes.length === 0 ? (
        <p className="ui-text-secondary">No step outcomes were persisted for this session.</p>
      ) : (
        <ul className="ui-stack ui-stack--xs">
          {outcomes.map((outcome) => (
            <li key={outcome.stepId} className="ui-text-secondary">
              {outcome.stepId}: {outcome.status} (attempts: {outcome.attempts})
              {outcome.toolId ? ` • tool ${outcome.toolId}` : ""}
              {outcome.outputAssetId ? ` • output ${outcome.outputAssetId}` : ""}
              {outcome.errorMessage ? ` • error ${outcome.errorMessage}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
