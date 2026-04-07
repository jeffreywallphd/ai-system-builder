import { AgentTriggerKinds, type AgentTriggerKind } from "../../../application/agents/contracts/AgentRunContracts";

interface TriggerSelectorProps {
  readonly value: AgentTriggerKind;
  readonly onChange: (value: AgentTriggerKind) => void;
  readonly disabled?: boolean;
}

export function TriggerSelector(props: TriggerSelectorProps): JSX.Element {
  return (
    <>
      <label className="ui-label" htmlFor="agent-trigger-kind">Trigger kind</label>
      <select
        id="agent-trigger-kind"
        className="ui-input"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value as AgentTriggerKind)}
      >
        <option value={AgentTriggerKinds.manual}>manual</option>
        <option value={AgentTriggerKinds.backend}>backend</option>
      </select>
    </>
  );
}
