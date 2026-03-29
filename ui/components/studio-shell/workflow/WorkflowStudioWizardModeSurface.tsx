import { useEffect, useMemo, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  WorkflowWizardSectionIds,
  deriveWorkflowWizardProgress,
  type WorkflowWizardSectionId,
} from "../../../studio-shell/workflow/WorkflowStudioWizardProgress";
import type { WorkflowStudioWizardPageId } from "../../../studio-shell/workflow/WorkflowStudioWizardRouting";
import WorkflowStudioInputSectionEditor from "./WorkflowStudioInputSectionEditor";
import WorkflowStudioOutputSectionEditor from "./WorkflowStudioOutputSectionEditor";
import WorkflowStudioStepSectionEditor from "./WorkflowStudioStepSectionEditor";
import WorkflowStudioTriggerSectionEditor from "./WorkflowStudioTriggerSectionEditor";

export interface WorkflowStudioWizardModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftValidationIssues?: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly selectedWizardPageId: WorkflowStudioWizardPageId;
  readonly onSelectWizardPage?: (pageId: WorkflowStudioWizardPageId) => void;
}

function isWorkflowWizardSectionId(value: string): value is WorkflowWizardSectionId {
  return (
    value === WorkflowWizardSectionIds.trigger
    || value === WorkflowWizardSectionIds.inputs
    || value === WorkflowWizardSectionIds.steps
    || value === WorkflowWizardSectionIds.outputs
  );
}

export default function WorkflowStudioWizardModeSurface({
  sharedDraft,
  sharedDraftSerialized,
  draftValidationIssues = [],
  onUpdateSharedDraft,
  studioId,
  selectedWizardPageId,
  onSelectWizardPage,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  const [readyActionAttempted, setReadyActionAttempted] = useState(false);
  const [readyActionConfirmed, setReadyActionConfirmed] = useState(false);
  const progress = deriveWorkflowWizardProgress(sharedDraft, draftValidationIssues);

  useEffect(() => {
    if (!progress.isWorkflowReady) {
      setReadyActionConfirmed(false);
    }
  }, [progress.isWorkflowReady]);

  const sectionsById = useMemo(
    () => new Map(progress.sections.map((section) => [section.id, section])),
    [progress.sections],
  );
  const orderedPageIds = useMemo(
    () => progress.sections
      .map((section) => section.id)
      .filter((sectionId): sectionId is WorkflowWizardSectionId => isWorkflowWizardSectionId(sectionId)),
    [progress.sections],
  );

  const activePageId = orderedPageIds.includes(selectedWizardPageId)
    ? selectedWizardPageId
    : orderedPageIds[0] ?? WorkflowWizardSectionIds.trigger;
  const activeSection = sectionsById.get(activePageId) ?? progress.sections[0];
  const activeSectionIndex = orderedPageIds.findIndex((sectionId) => sectionId === activePageId);
  const previousPageId = activeSectionIndex > 0 ? orderedPageIds[activeSectionIndex - 1] : undefined;
  const nextPageId = activeSectionIndex >= 0 && activeSectionIndex < orderedPageIds.length - 1
    ? orderedPageIds[activeSectionIndex + 1]
    : undefined;
  const firstIncompleteSection = progress.firstIncompleteSectionId
    ? sectionsById.get(progress.firstIncompleteSectionId)
    : undefined;

  const selectPage = (pageId: WorkflowStudioWizardPageId): void => {
    onSelectWizardPage?.(pageId);
  };

  const handleReadyAction = () => {
    setReadyActionAttempted(true);
    if (!progress.isWorkflowReady) {
      setReadyActionConfirmed(false);
      return;
    }
    setReadyActionConfirmed(true);
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <section className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-wizard-pages-card">
        <nav className="ui-stack ui-stack--2xs" aria-label="Workflow wizard pages">
          <div className="ui-workflow-wizard__page-buttons">
            {progress.sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`ui-button ui-button--sm ${section.id === activePageId ? "ui-button--primary" : "ui-button--ghost"}`}
                data-testid={`workflow-wizard-page-button-${section.id}`}
                aria-current={section.id === activePageId ? "page" : undefined}
                onClick={() => selectPage(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
        </nav>
        <div data-testid={`workflow-wizard-page-${activePageId}`}>
          {activePageId === WorkflowWizardSectionIds.trigger ? (
            <WorkflowStudioTriggerSectionEditor
              sharedDraft={sharedDraft}
              draftValidationIssues={draftValidationIssues}
              onUpdateSharedDraft={onUpdateSharedDraft}
            />
          ) : null}

          {activePageId === WorkflowWizardSectionIds.inputs ? (
            <WorkflowStudioInputSectionEditor
              sharedDraft={sharedDraft}
              draftValidationIssues={draftValidationIssues}
              onUpdateSharedDraft={onUpdateSharedDraft}
              studioId={studioId}
            />
          ) : null}

          {activePageId === WorkflowWizardSectionIds.steps ? (
            <WorkflowStudioStepSectionEditor
              sharedDraft={sharedDraft}
              draftValidationIssues={draftValidationIssues}
              onUpdateSharedDraft={onUpdateSharedDraft}
              studioId={studioId}
            />
          ) : null}

          {activePageId === WorkflowWizardSectionIds.outputs ? (
            <WorkflowStudioOutputSectionEditor
              sharedDraft={sharedDraft}
              draftValidationIssues={draftValidationIssues}
              onUpdateSharedDraft={onUpdateSharedDraft}
            />
          ) : null}
        </div>
      </section>

      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-wizard-progression-controls">
        <div className="ui-workflow-wizard__navigation-actions">
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            data-testid="workflow-wizard-back-page"
            disabled={!previousPageId}
            onClick={() => {
              if (previousPageId) {
                selectPage(previousPageId);
              }
            }}
          >
            Back
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            data-testid="workflow-wizard-next-page"
            disabled={!nextPageId}
            onClick={() => {
              if (nextPageId) {
                selectPage(nextPageId);
              }
            }}
          >
            Next
          </button>
        </div>
        <p className="ui-text-muted">
          Current focus: <strong>{activeSection?.title ?? "Trigger"}</strong>. Progress: {progress.readySectionCount}/{progress.sections.length} sections ready.
        </p>
      </div>

      {activePageId === WorkflowWizardSectionIds.outputs ? (
        <>
          <section
            id="workflow-wizard-terminal-actions"
            className="ui-card ui-card--padded ui-stack ui-stack--2xs"
            data-testid="workflow-wizard-terminal-actions"
          >
            <strong>Prepare for run handoff</strong>
            {progress.isWorkflowReady ? (
              <p className="ui-text-muted">
                Ready for next-stage handoff. Save the draft and continue to lifecycle/publish controls.
              </p>
            ) : (
              <p className="ui-text-muted">
                Resolve remaining blockers before handoff. Completed: {progress.completedSectionCount}/{progress.sections.length}.
              </p>
            )}
            {readyActionAttempted && !progress.isWorkflowReady ? (
              <p className="ui-text-danger" data-testid="workflow-wizard-ready-blocked">
                Cannot prepare for run yet. Resolve the blocking sections listed above.
              </p>
            ) : null}
            {readyActionConfirmed ? (
              <p className="ui-text-muted" data-testid="workflow-wizard-ready-confirmed">
                Wizard handoff marked ready. Continue to <a href="#studio-shell-lifecycle-panel">Lifecycle / publish / version status</a>.
              </p>
            ) : null}
            <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
              {firstIncompleteSection ? (
                <button
                  type="button"
                  className="ui-button ui-button--ghost ui-button--sm"
                  data-testid="workflow-wizard-jump-incomplete"
                  onClick={() => selectPage(firstIncompleteSection.id)}
                >
                  Jump to first incomplete
                </button>
              ) : (
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled data-testid="workflow-wizard-jump-incomplete">
                  Jump to first incomplete
                </button>
              )}
              <a className="ui-button ui-button--sm" href="#workflow-wizard-json-preview" data-testid="workflow-wizard-review-draft">
                Review draft JSON
              </a>
              <button
                type="button"
                className="ui-button ui-button--primary ui-button--sm"
                onClick={handleReadyAction}
                data-testid="workflow-wizard-ready-action"
              >
                Prepare for Run
              </button>
            </div>
          </section>

          <label className="ui-stack ui-stack--2xs">
            <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
            <textarea id="workflow-wizard-json-preview" className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
          </label>
        </>
      ) : null}

      <details className="ui-card ui-card--padded ui-workflow-wizard__readiness" data-testid="workflow-wizard-readiness-summary">
        <summary className="ui-workflow-wizard__readiness-summary">
          <strong>Workflow readiness summary</strong>
        </summary>
        <div className="ui-stack ui-stack--2xs ui-workflow-wizard__readiness-content">
          <p className="ui-text-muted">
            {progress.isWorkflowReady
              ? "Workflow draft is ready for handoff."
              : `Workflow draft is not ready yet. ${progress.blockingIssueCount} blocking item(s) remain.`}
            {" "}
            Inputs policy: {progress.readinessPolicy.inputs === "required" ? "required for this wizard pass" : "optional"}.
          </p>
          {progress.blockingIssues.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs">
              {progress.blockingIssues.map((issue) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost ui-button--sm"
                    onClick={() => selectPage(issue.sectionId)}
                  >
                    {issue.sectionTitle}: {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-text-muted">No blocking issues detected.</p>
          )}
        </div>
      </details>
    </div>
  );
}
