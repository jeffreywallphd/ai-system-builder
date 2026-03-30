import { useMemo } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  applyWorkflowCanvasAction,
  deriveWorkflowCanvasViewModel,
  WorkflowCanvasSectionIds,
  type WorkflowCanvasAction,
  type WorkflowCanvasSectionViewModel,
} from "../../../studio-shell/workflow/WorkflowStudioCanvasViewModel";
import WorkflowStudioCanvasReactFlow from "./WorkflowStudioCanvasReactFlow";

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
    <div className="ui-stack ui-stack--sm ui-workflow-studio-canvas" data-testid="workflow-studio-canvas-mode-surface">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-summary">
        <strong>Workflow Canvas</strong>
        <p className="ui-text-muted">
          React Flow canvas projection over the canonical workflow draft. Canvas and wizard write through the same shared draft state.
        </p>
        <p className="ui-text-small ui-text-secondary">
          Nodes: {viewModel.totalNodeCount} | Validation issues: {viewModel.totalIssueCount}
        </p>
      </section>

      <section className="ui-card ui-card--padded ui-stack ui-stack--sm" data-testid="workflow-studio-canvas-sections">
        <header className="ui-row ui-row--between ui-row--wrap">
          <strong>Core workflow sections</strong>
          <span className="ui-text-small ui-text-secondary">Rendered as React Flow section and item nodes</span>
        </header>
        <div className="ui-workflow-studio-canvas__section-grid">
          {viewModel.sections.map((section) => (
            <section key={section.id} className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid={`workflow-canvas-section-${section.id}`}>
              <div className="ui-row ui-row--between ui-row--wrap">
                <strong>{section.title}</strong>
                <span className="ui-text-small ui-text-secondary">{section.nodes.length} node(s)</span>
              </div>
              <p className="ui-text-muted">{section.summary}</p>
              <button
                type="button"
                className="ui-button ui-button--ghost ui-button--sm"
                data-testid={`workflow-canvas-add-${section.id}`}
                onClick={() => applyAction(getSectionAddAction(section))}
              >
                {getSectionAddLabel(section)}
              </button>
            </section>
          ))}
        </div>
      </section>

      <WorkflowStudioCanvasReactFlow graph={viewModel.graph} />

      <details className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-studio-canvas-graph-details">
        <summary className="ui-text-small">Canvas graph projection</summary>
        <p className="ui-text-small ui-text-secondary">
          Graph nodes: {viewModel.graph.nodes.length} | Graph edges: {viewModel.graph.edges.length}
        </p>
      </details>

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
