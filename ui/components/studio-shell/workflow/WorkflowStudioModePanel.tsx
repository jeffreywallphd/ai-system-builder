import type { WorkflowStudioModeState } from "../../../studio-shell/workflow/WorkflowStudioModeStateStore";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";
import { listWorkflowOutputSummaries } from "../../../studio-shell/workflow/WorkflowWizardOutputs";

export interface WorkflowStudioModePanelProps {
  readonly workflowModeState: {
    readonly state: WorkflowStudioModeState;
    readonly setSelectedMode: (modeId: WorkflowStudioModeId) => void;
  };
}

function buildModeSummary(state: WorkflowStudioModeState): string {
  const draft = state.sharedDraft;
  return `${draft.triggers.length} triggers, ${draft.inputs.length} inputs, ${draft.steps.length} steps, ${draft.outputs.length} outputs`;
}

function renderModeSurface(modeId: WorkflowStudioModeId): JSX.Element {
  if (modeId === "wizard") {
    return (
      <p className="ui-text-muted">
        Wizard mode uses the structured Trigger, Inputs, Steps, and Outputs layout over the shared canonical workflow draft.
      </p>
    );
  }

  return (
    <p className="ui-text-muted">
      Canvas mode maps to the current Workflow Studio implementation path while reusing the same shared canonical workflow draft state.
    </p>
  );
}

export default function WorkflowStudioModePanel({ workflowModeState }: WorkflowStudioModePanelProps): JSX.Element {
  const state = workflowModeState.state;
  const outputSummaries = listWorkflowOutputSummaries(state.sharedDraft);

  return (
    <section className="ui-stack ui-stack--sm" data-testid="workflow-studio-mode-panel">
      <div className="ui-stack ui-stack--2xs">
        <strong>Workflow authoring mode</strong>
        <p className="ui-text-muted">Select how to author this workflow draft without changing the underlying canonical draft model.</p>
      </div>

      <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
        {state.availableModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`ui-button ui-button--sm ${state.selectedModeId === mode.id ? "ui-button--primary" : "ui-button--ghost"}`}
            aria-pressed={state.selectedModeId === mode.id}
            onClick={() => workflowModeState.setSelectedMode(mode.id)}
          >
            {mode.title}
          </button>
        ))}
      </div>

      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs">
        <div><strong>Active mode:</strong> {state.selectedMode.title}</div>
        <div><strong>Intent:</strong> {state.selectedMode.intent}</div>
        <div><strong>Shared draft:</strong> {buildModeSummary(state)}</div>
        <div><strong>Shared draft valid:</strong> {state.isSharedDraftValid ? "yes" : "no"}</div>
        <div><strong>Mode validation issues:</strong> {state.modeValidationIssues.length}</div>
        <div><strong>Draft validation issues:</strong> {state.draftValidationIssues.length}</div>
        {renderModeSurface(state.selectedModeId)}
      </div>

      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-mode-output-overview">
        <strong>Configured outputs</strong>
        {outputSummaries.length > 0 ? (
          <ul className="ui-stack ui-stack--2xs ui-workflow-wizard__output-summary-list">
            {outputSummaries.map((summary) => (
              <li key={summary.outputId} className="ui-workflow-wizard__output-summary-item">
                <div><strong>{summary.order}. {summary.displayLabel}</strong> <span className="ui-text-secondary">({summary.typeLabel})</span></div>
                {summary.detailLines.length > 0 ? (
                  <div className="ui-text-small ui-text-secondary">{summary.detailLines.join(" · ")}</div>
                ) : (
                  <div className="ui-text-small ui-text-secondary">No additional output details configured.</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ui-text-muted">No outputs configured yet.</p>
        )}
      </div>

      {state.draftParseError ? (
        <p className="ui-text-muted">
          Workflow draft parse issue: {state.draftParseError}
        </p>
      ) : null}

      {state.modeValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Validation hook status: {state.modeValidationIssues.length} mode-level issue(s) detected.
        </p>
      ) : null}
    </section>
  );
}
