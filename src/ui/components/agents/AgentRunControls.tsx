import type { AgentRunControlAction, AgentSessionSummaryReadModel } from "../../../application/agents/contracts/AgentRunContracts";

interface AgentRunControlsProps {
  readonly session?: AgentSessionSummaryReadModel;
  readonly controls: ReadonlyArray<AgentRunControlAction>;
  readonly isBusy: boolean;
  readonly pendingAction?: AgentRunControlAction;
  readonly onControlRun: (sessionId: string, action: AgentRunControlAction) => void;
}

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

export function AgentRunControls(props: AgentRunControlsProps): JSX.Element | null {
  if (!props.session || props.controls.length === 0) {
    return null;
  }

  const isTerminal = terminalStatuses.has(props.session.status);

  return (
    <div className="ui-row ui-row--wrap" data-testid="agent-run-controls">
      {props.controls.includes("cancel") ? (
        <button
          className="ui-button ui-button--secondary ui-button--sm"
          disabled={props.isBusy || isTerminal || props.pendingAction === "cancel"}
          onClick={() => props.onControlRun(props.session!.sessionId, "cancel")}
        >
          {props.pendingAction === "cancel" ? "Cancelling..." : "Cancel run"}
        </button>
      ) : null}
    </div>
  );
}
