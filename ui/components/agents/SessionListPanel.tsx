import type { AgentRunControlAction, AgentSessionSummaryReadModel } from "../../../application/agents/contracts/AgentRunContracts";
import { AgentRunControls } from "./AgentRunControls";

interface SessionListPanelProps {
  readonly sessions: ReadonlyArray<AgentSessionSummaryReadModel>;
  readonly controls: ReadonlyArray<AgentRunControlAction>;
  readonly selectedSessionId?: string;
  readonly isBusy: boolean;
  readonly pendingControlAction?: AgentRunControlAction;
  readonly onSelectSession: (sessionId: string) => void;
  readonly onControlRun: (sessionId: string, action: AgentRunControlAction) => void;
}

export function SessionListPanel(props: SessionListPanelProps): JSX.Element {
  return (
    <div className="ui-card ui-stack ui-stack--sm" data-testid="session-list-panel">
      <h3 className="ui-heading-3">Session list</h3>
      <ul className="ui-stack ui-stack--xs">
        {props.sessions.map((session) => (
          <li key={session.sessionId}>
            <button
              className="ui-button ui-button--ghost ui-button--sm"
              onClick={() => props.onSelectSession(session.sessionId)}
              disabled={props.isBusy}
              aria-pressed={props.selectedSessionId === session.sessionId}
            >
              {session.sessionId} — {session.status} ({session.completedStepCount}/{session.attemptedStepCount})
            </button>
            <div className="ui-text-secondary">
              {session.terminalReason ?? "active"} • {session.composition.taxonomy.semanticRole}
            </div>
            <AgentRunControls
              session={session}
              controls={props.controls}
              isBusy={props.isBusy}
              pendingAction={props.pendingControlAction}
              onControlRun={props.onControlRun}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
