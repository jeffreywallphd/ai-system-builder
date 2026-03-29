import type { WorkflowStudioModeState } from "../../../studio-shell/workflow/WorkflowStudioModeStateStore";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";

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
        Wizard mode is registered and uses the shared canonical workflow draft; follow-up stories can layer guided step UX on top of this state.
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
        {renderModeSurface(state.selectedModeId)}
      </div>

      {state.draftParseError ? (
        <p className="ui-text-muted">
          Workflow draft parse issue: {state.draftParseError}
        </p>
      ) : null}
    </section>
  );
}
