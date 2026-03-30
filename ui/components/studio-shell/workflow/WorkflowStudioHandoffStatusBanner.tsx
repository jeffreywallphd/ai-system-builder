import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
  type WorkflowStudioHandoffStatus,
} from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";

export interface WorkflowStudioHandoffStatusBannerProps {
  readonly status?: WorkflowStudioHandoffStatus;
  readonly onDismiss?: () => void;
}

function getFlowLabel(flow: WorkflowStudioHandoffStatus["flow"]): string {
  if (flow === WorkflowStudioHandoffFlowKinds.agentStep) {
    return "agent/assistant";
  }
  return "dataset";
}

function getStepTargetLabel(selectorTargetId: string | undefined): string {
  const target = selectorTargetId?.trim();
  if (!target || target === "workflow-step:new") {
    return "new step selector";
  }
  if (target.startsWith("workflow-step:")) {
    return "step selector";
  }
  return "step";
}

function getBadgeClassName(kind: WorkflowStudioHandoffStatus["kind"]): string {
  if (kind === WorkflowStudioHandoffStatusKinds.completed) {
    return "ui-badge ui-badge--success";
  }
  if (kind === WorkflowStudioHandoffStatusKinds.cancelled || kind === WorkflowStudioHandoffStatusKinds.recovered) {
    return "ui-badge ui-badge--warning";
  }
  return "ui-badge ui-badge--info";
}

function getBadgeLabel(kind: WorkflowStudioHandoffStatus["kind"]): string {
  if (kind === WorkflowStudioHandoffStatusKinds.launching) {
    return "Launching";
  }
  if (kind === WorkflowStudioHandoffStatusKinds.pending) {
    return "Pending";
  }
  if (kind === WorkflowStudioHandoffStatusKinds.resumed) {
    return "Resumed";
  }
  if (kind === WorkflowStudioHandoffStatusKinds.completed) {
    return "Completed";
  }
  if (kind === WorkflowStudioHandoffStatusKinds.cancelled) {
    return "Cancelled";
  }
  return "Recovered";
}

function getStatusMessage(status: WorkflowStudioHandoffStatus): string {
  const flowLabel = getFlowLabel(status.flow);
  if (status.detail?.trim()) {
    return status.detail.trim();
  }

  if (status.kind === WorkflowStudioHandoffStatusKinds.launching) {
    return `Launching ${flowLabel} studio handoff.`;
  }
  if (status.kind === WorkflowStudioHandoffStatusKinds.pending) {
    return `Waiting for ${flowLabel} handoff return.`;
  }
  if (status.kind === WorkflowStudioHandoffStatusKinds.resumed) {
    return `Workflow session resumed after ${flowLabel} handoff.`;
  }
  if (status.kind === WorkflowStudioHandoffStatusKinds.completed) {
    if (status.flow === WorkflowStudioHandoffFlowKinds.agentStep) {
      const name = status.assetDisplayName?.trim() || status.assetId || "returned asset";
      return `Added ${name} to ${getStepTargetLabel(status.selectorTargetId)}.`;
    }
    const name = status.assetDisplayName?.trim() || status.assetId || "returned dataset";
    return `Added ${name} to workflow inputs.`;
  }
  if (status.kind === WorkflowStudioHandoffStatusKinds.cancelled) {
    return `${flowLabel[0]?.toUpperCase() ?? ""}${flowLabel.slice(1)} handoff ended without a selection. Draft state was preserved.`;
  }
  return `${flowLabel[0]?.toUpperCase() ?? ""}${flowLabel.slice(1)} handoff recovery ignored a stale or invalid return payload.`;
}

export default function WorkflowStudioHandoffStatusBanner({
  status,
  onDismiss,
}: WorkflowStudioHandoffStatusBannerProps): JSX.Element | null {
  if (!status) {
    return null;
  }

  return (
    <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-handoff-status-banner">
      <div className="ui-row ui-row--between ui-row--wrap" style={{ gap: "0.5rem" }}>
        <strong>Cross-studio handoff status</strong>
        <span className={getBadgeClassName(status.kind)} data-testid="workflow-handoff-status-badge">
          {getBadgeLabel(status.kind)}
        </span>
      </div>
      <p className="ui-text-small ui-text-secondary" data-testid="workflow-handoff-status-message">
        {getStatusMessage(status)}
      </p>
      {onDismiss ? (
        <div className="ui-row ui-row--end">
          <button
            type="button"
            className="ui-button ui-button--ghost ui-button--sm"
            onClick={onDismiss}
            data-testid="workflow-handoff-status-dismiss"
          >
            Clear status
          </button>
        </div>
      ) : null}
    </section>
  );
}

