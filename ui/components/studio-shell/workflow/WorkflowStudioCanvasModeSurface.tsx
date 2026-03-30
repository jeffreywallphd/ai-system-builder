import { useMemo } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  WorkflowCanvasSectionIds,
  type WorkflowCanvasAction,
  type WorkflowCanvasSectionViewModel,
} from "../../../studio-shell/workflow/WorkflowStudioCanvasViewModel";

export interface WorkflowStudioCanvasModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly draftEditorContent: string;
  readonly onChangeDraftEditorContent: (nextContent: string) => void;
}

function getSectionAddAction(section: WorkflowCanvasSectionViewModel): WorkflowCanvasAction {
  if (section.id === WorkflowCanvasSectionIds.triggers) {
    return Object.freeze({ kind: "add-trigger" });
  }
  if (section.id === WorkflowCanvasSectionIds.inputs) {
    return Object.freeze({ kind: "add-input-runtime-parameter" });
  }
  if (section.id === WorkflowCanvasSectionIds.steps) {
    return Object.freeze({ kind: "add-step" });
  }
  return Object.freeze({ kind: "add-output" });
}

function getSectionAddLabel(section: WorkflowCanvasSectionViewModel): string {
  if (section.id === WorkflowCanvasSectionIds.triggers) {
    return "Add trigger";
  }
  if (section.id === WorkflowCanvasSectionIds.inputs) {
    return "Add input";
  }
  if (section.id === WorkflowCanvasSectionIds.steps) {
    return "Add step";
  }
  return "Add output";
}

export default function WorkflowStudioCanvasModeSurface({
  sharedDraft,
  draftValidationIssues,
  onUpdateSharedDraft,
  draftEditorContent,
  onChangeDraftEditorContent,
}: WorkflowStudioCanvasModeSurfaceProps): JSX.Element {
  const viewModel = useMemo(
    () => deriveWorkflowCanvasViewModel(sharedDraft, draftValidationIssues),
    [draftValidationIssues, sharedDraft],
  );

  const applyAction = (action: WorkflowCanvasAction): void => {
    if (!onUpdateSharedDraft) {
      return;
    }

    onUpdateSharedDraft((draft) => applyWorkflowCanvasAction(draft, action).draft);
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-canvas-mode-surface">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-summary">
        <strong>Workflow Canvas</strong>
        <p className="ui-text-muted">
          Section-backed canvas projection over the canonical workflow draft. Canvas and wizard write through the same shared draft state.
        </p>
        <p className="ui-text-small ui-text-secondary">
          Nodes: {viewModel.totalNodeCount} | Validation issues: {viewModel.totalIssueCount}
        </p>
      </section>

      <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-canvas-sections">
        {viewModel.sections.map((section) => (
          <section key={section.id} className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid={`workflow-canvas-section-${section.id}`}>
            <header className="ui-row ui-row--between ui-row--wrap">
              <div className="ui-stack ui-stack--2xs">
                <strong>{section.title}</strong>
                <p className="ui-text-muted">{section.summary}</p>
                <p className="ui-text-small ui-text-secondary">{section.nodes.length} node(s)</p>
              </div>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                data-testid={`workflow-canvas-add-${section.id}`}
                onClick={() => applyAction(getSectionAddAction(section))}
              >
                {getSectionAddLabel(section)}
              </button>
            </header>

            {section.nodes.length === 0 ? (
              <p className="ui-text-muted">No nodes in this section yet.</p>
            ) : (
              <ul className="ui-stack ui-stack--xs">
                {section.nodes.map((node) => (
                  <li key={node.id} className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid={`workflow-canvas-node-${section.id}-${node.id}`}>
                    <div className="ui-row ui-row--between ui-row--wrap">
                      <strong>{node.subtitle}</strong>
                      <button
                        type="button"
                        className="ui-button ui-button--ghost ui-button--sm"
                        data-testid={`workflow-canvas-remove-${section.id}-${node.id}`}
                        onClick={() => {
                          if (section.id === WorkflowCanvasSectionIds.triggers) {
                            applyAction({ kind: "remove-trigger", triggerId: node.id });
                            return;
                          }
                          if (section.id === WorkflowCanvasSectionIds.inputs) {
                            applyAction({ kind: "remove-input", inputId: node.id });
                            return;
                          }
                          if (section.id === WorkflowCanvasSectionIds.steps) {
                            applyAction({ kind: "remove-step", stepId: node.id });
                            return;
                          }
                          applyAction({ kind: "remove-output", outputId: node.id });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <label className="ui-field">
                      <span className="ui-field__label">Title</span>
                      <input
                        className="ui-input"
                        value={node.title}
                        data-testid={`workflow-canvas-title-${section.id}-${node.id}`}
                        onChange={(event) => {
                          if (section.id === WorkflowCanvasSectionIds.triggers) {
                            applyAction({ kind: "set-trigger-title", triggerId: node.id, title: event.target.value });
                            return;
                          }
                          if (section.id === WorkflowCanvasSectionIds.inputs) {
                            applyAction({ kind: "set-input-title", inputId: node.id, title: event.target.value });
                            return;
                          }
                          if (section.id === WorkflowCanvasSectionIds.steps) {
                            applyAction({ kind: "set-step-title", stepId: node.id, title: event.target.value });
                            return;
                          }
                          applyAction({ kind: "set-output-title", outputId: node.id, title: event.target.value });
                        }}
                      />
                    </label>

                    {node.detailLines.length > 0 ? (
                      <ul className="ui-stack ui-stack--2xs">
                        {node.detailLines.map((line, index) => (
                          <li key={`${node.id}-detail-${index}`} className="ui-text-small ui-text-secondary">{line}</li>
                        ))}
                      </ul>
                    ) : null}

                    {node.issueMessages.length > 0 ? (
                      <ul className="ui-stack ui-stack--2xs">
                        {node.issueMessages.map((message, index) => (
                          <li key={`${node.id}-issue-${index}`} className="ui-text-small ui-text-danger">{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-json-details">
        <summary className="ui-text-small">Canonical workflow draft JSON</summary>
        <textarea
          className="ui-textarea"
          rows={8}
          value={draftEditorContent}
          onChange={(event) => onChangeDraftEditorContent(event.target.value)}
        />
      </details>
    </div>
  );
}
