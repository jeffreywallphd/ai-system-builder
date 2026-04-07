import type { AgentRunControlAction, AgentSessionDetailReadModel } from "@application/agents/contracts/AgentRunContracts";
import { AgentRunControls } from "./AgentRunControls";
import type { CanonicalAssetManagementService } from "../../services/CanonicalAssetManagementService";
import { CompositionSummaryCard } from "./CompositionSummaryCard";
import { SessionOperationalSummary } from "./SessionOperationalSummary";
import { SessionTransitionHistoryPanel } from "./SessionTransitionHistoryPanel";
import { SessionStepOutcomePanel } from "./SessionStepOutcomePanel";
import { SessionDiagnosticAssetsPanel } from "./SessionDiagnosticAssetsPanel";

interface SessionDetailPanelProps {
  readonly session?: AgentSessionDetailReadModel;
  readonly controls: ReadonlyArray<AgentRunControlAction>;
  readonly isBusy: boolean;
  readonly canonicalAssetManagementService: CanonicalAssetManagementService;
  readonly pendingControlAction?: AgentRunControlAction;
  readonly onControlRun: (sessionId: string, action: AgentRunControlAction) => void;
}

export function SessionDetailPanel(props: SessionDetailPanelProps): JSX.Element {
  if (!props.session) {
    return (
      <div className="ui-card ui-stack ui-stack--sm" data-testid="session-detail-panel">
        <h3 className="ui-heading-3">Session detail</h3>
        <p className="ui-text-secondary">Select a session to view detail.</p>
      </div>
    );
  }

  return (
    <div className="ui-card ui-stack ui-stack--sm" data-testid="session-detail-panel">
      <h3 className="ui-heading-3">Session detail</h3>
      <p className="ui-text-secondary">Session {props.session.summary.sessionId} is {props.session.summary.status}.</p>
      <AgentRunControls
        session={props.session.summary}
        controls={props.controls}
        isBusy={props.isBusy}
        pendingAction={props.pendingControlAction}
        onControlRun={props.onControlRun}
      />
      <SessionOperationalSummary session={props.session} />
      <CompositionSummaryCard
        title="Session composition"
        taxonomy={props.session.composition.taxonomy}
        contract={props.session.composition.contract}
      />
      <SessionTransitionHistoryPanel session={props.session} />
      <SessionStepOutcomePanel session={props.session} />
      <SessionDiagnosticAssetsPanel
        session={props.session}
        canonicalAssetManagementService={props.canonicalAssetManagementService}
      />
    </div>
  );
}

