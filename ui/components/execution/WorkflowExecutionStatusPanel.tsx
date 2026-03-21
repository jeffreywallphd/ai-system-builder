import type { WorkflowExecutionStatus } from "../../../application/ports/interfaces/IWorkflowExecutor";
import type { IWorkflowExecutionProvenance } from "../../../application/ports/interfaces/IWorkflowExecutor";

export interface WorkflowExecutionStatusPanelProps {
  readonly executionId?: string;
  readonly status: WorkflowExecutionStatus;
  readonly currentNodeId?: string;
  readonly progressPercent?: number;
  readonly message?: string;
  readonly provenance?: IWorkflowExecutionProvenance;
}

export default function WorkflowExecutionStatusPanel({
  executionId,
  status,
  currentNodeId,
  progressPercent,
  message,
  provenance,
}: WorkflowExecutionStatusPanelProps): JSX.Element {
  return (
    <section className="ui-panel ui-panel--elevated" aria-live="polite">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Workflow Execution</div>
          <div className="ui-panel__subtitle">Execution state for the active run.</div>
        </div>
        <span className="ui-badge ui-badge--info">{status}</span>
      </div>

      <div className="ui-panel__body">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Execution Id</div>
            <div className="ui-meta-value">{executionId ?? "—"}</div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Current Node</div>
            <div className="ui-meta-value">{currentNodeId ?? "—"}</div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Progress</div>
            <div className="ui-meta-value">
              {typeof progressPercent === "number" ? `${progressPercent}%` : "—"}
            </div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Execution Path</div>
            <div className="ui-meta-value">{provenance?.classification ?? "—"}</div>
          </div>
        </div>

        {message ? <p className="ui-muted">{message}</p> : null}
        {provenance?.detail ? <p className="ui-muted">{provenance.detail}</p> : null}
      </div>
    </section>
  );
}
