import { AgentTriggerKinds, type AgentTriggerKind } from "@application/agents/contracts/AgentRunContracts";

interface TriggerConfigFieldsProps {
  readonly triggerKind: AgentTriggerKind;
  readonly invokedBy: string;
  readonly source: string;
  readonly disabled?: boolean;
  readonly onInvokedByChange: (value: string) => void;
  readonly onSourceChange: (value: string) => void;
}

export function TriggerConfigFields(props: TriggerConfigFieldsProps): JSX.Element {
  const showSource = props.triggerKind === AgentTriggerKinds.backend;

  return (
    <>
      <label className="ui-label">trigger.invokedBy</label>
      <input
        className="ui-input"
        value={props.invokedBy}
        disabled={props.disabled}
        onChange={(event) => props.onInvokedByChange(event.target.value)}
      />
      {showSource ? (
        <>
          <label className="ui-label">trigger.source</label>
          <input
            className="ui-input"
            value={props.source}
            disabled={props.disabled}
            onChange={(event) => props.onSourceChange(event.target.value)}
          />
        </>
      ) : null}
    </>
  );
}

