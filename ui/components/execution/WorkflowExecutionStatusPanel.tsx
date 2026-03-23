import type { WorkflowExecutionStatusViewModel } from "../../presenters/WorkflowExecutionPresenter";

export interface WorkflowExecutionStatusPanelProps {
  readonly viewModel: WorkflowExecutionStatusViewModel;
}

export default function WorkflowExecutionStatusPanel({
  viewModel,
}: WorkflowExecutionStatusPanelProps): JSX.Element {
  return (
    <section className="ui-panel ui-panel--elevated" aria-live="polite">
      <div className="ui-panel__header">
        <div>
          <div className="ui-panel__title">Workflow Execution</div>
          <div className="ui-panel__subtitle">Execution state for the active run.</div>
        </div>
        <span className={`ui-badge ui-badge--${viewModel.statusTone}`}>{viewModel.statusLabel}</span>
      </div>

      <div className="ui-panel__body">
        <div className="ui-meta-grid">
          <div className="ui-meta-item">
            <div className="ui-meta-label">Execution Id</div>
            <div className="ui-meta-value">{viewModel.executionId}</div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Current Node</div>
            <div className="ui-meta-value">{viewModel.currentNodeLabel}</div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Progress</div>
            <div className="ui-meta-value">{viewModel.progressLabel}</div>
          </div>

          <div className="ui-meta-item">
            <div className="ui-meta-label">Execution Path</div>
            <div className="ui-meta-value">{viewModel.executionPathLabel}</div>
          </div>
        </div>

        {viewModel.message ? <p className="ui-muted">{viewModel.message}</p> : null}
        {viewModel.detail ? <p className="ui-muted">{viewModel.detail}</p> : null}
        {viewModel.selectionReason ? <p className="ui-muted">Selection: {viewModel.selectionReason}</p> : null}
        {viewModel.fallbackSummary ? <p className="ui-muted">Fallback: <strong>{viewModel.fallbackSummary}</strong></p> : null}
        {viewModel.outputSummary ? <p className="ui-muted">Outputs: {viewModel.outputSummary}</p> : null}
        {viewModel.nodeTruthfulnessSummary ? (
          <p className="ui-muted">Node truthfulness — {viewModel.nodeTruthfulnessSummary}.</p>
        ) : null}
      </div>
    </section>
  );
}
