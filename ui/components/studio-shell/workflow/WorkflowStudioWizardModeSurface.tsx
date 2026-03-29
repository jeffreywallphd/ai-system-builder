import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioTriggerSectionEditor from "./WorkflowStudioTriggerSectionEditor";
import WorkflowStudioInputSectionEditor from "./WorkflowStudioInputSectionEditor";
import WorkflowStudioStepSectionEditor from "./WorkflowStudioStepSectionEditor";
import WorkflowStudioOutputSectionEditor from "./WorkflowStudioOutputSectionEditor";
import {
  deriveWorkflowWizardProgress,
  type WorkflowWizardSectionId,
} from "../../../studio-shell/workflow/WorkflowStudioWizardProgress";

export interface WorkflowStudioWizardModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftValidationIssues?: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly routeSearch?: string;
  readonly onReplaceRouteSearch?: (nextSearch: string) => void;
}

export default function WorkflowStudioWizardModeSurface({
  sharedDraft,
  sharedDraftSerialized,
  draftValidationIssues = [],
  onUpdateSharedDraft,
  studioId,
  routeSearch,
  onReplaceRouteSearch,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  const progress = deriveWorkflowWizardProgress(sharedDraft, draftValidationIssues);
  const sectionById = new Map(progress.sections.map((section) => [section.id, section]));
  const currentSection = sectionById.get(progress.currentSectionId) ?? progress.sections[0];
  const previousSection = progress.previousSectionId
    ? sectionById.get(progress.previousSectionId)
    : undefined;
  const nextSection = progress.nextSectionId
    ? sectionById.get(progress.nextSectionId)
    : undefined;
  const firstIncompleteSection = progress.firstIncompleteSectionId
    ? sectionById.get(progress.firstIncompleteSectionId)
    : undefined;

  const currentIndex = progress.sections.findIndex((section) => section.id === progress.currentSectionId);
  const toFlowLabel = (sectionId: WorkflowWizardSectionId): string => {
    const sectionIndex = progress.sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex < 0) {
      return "Section";
    }
    if (sectionIndex === currentIndex) {
      return "Current";
    }
    return sectionIndex < currentIndex ? "Completed" : "Upcoming";
  };

  const toStatusLabel = (sectionId: WorkflowWizardSectionId): string => {
    const section = sectionById.get(sectionId);
    if (!section) {
      return "";
    }
    if (section.statusLabel === "ready") {
      return "Ready";
    }
    if (section.statusLabel === "has-issues") {
      return "Needs review";
    }
    return "Needs input";
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <nav className="ui-stack ui-stack--2xs" aria-label="Wizard sections">
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          {progress.sections.map((section) => (
            <a
              key={section.id}
              className={`ui-button ui-button--sm ${section.id === progress.currentSectionId ? "ui-button--primary" : "ui-button--ghost"}`}
              href={`#${section.anchorId}`}
              aria-current={section.id === progress.currentSectionId ? "step" : undefined}
            >
              {section.title}
            </a>
          ))}
        </div>
        <div className="ui-row ui-row--wrap ui-text-small ui-text-secondary" style={{ gap: "0.75rem" }}>
          {progress.sections.map((section) => (
            <span key={`${section.id}-status`}>
              {section.title}: {toFlowLabel(section.id)} ({toStatusLabel(section.id)})
            </span>
          ))}
        </div>
      </nav>

      <div className="ui-card ui-card--padded ui-stack ui-stack--2xs" data-testid="workflow-wizard-progression-controls">
        <strong>Guided progression</strong>
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          {previousSection ? (
            <a className="ui-button ui-button--ghost ui-button--sm" href={`#${previousSection.anchorId}`} data-testid="workflow-wizard-prev-section">
              Previous section
            </a>
          ) : (
            <button type="button" className="ui-button ui-button--ghost ui-button--sm" disabled data-testid="workflow-wizard-prev-section">
              Previous section
            </button>
          )}

          {nextSection ? (
            <a className="ui-button ui-button--sm" href={`#${nextSection.anchorId}`} data-testid="workflow-wizard-next-section">
              Next section
            </a>
          ) : (
            <button type="button" className="ui-button ui-button--sm" disabled data-testid="workflow-wizard-next-section">
              Next section
            </button>
          )}
        </div>
        <p className="ui-text-muted">
          Current focus: <strong>{currentSection?.title ?? "Trigger"}</strong>. Progress: {progress.readySectionCount}/{progress.sections.length} sections ready.
        </p>
      </div>

      <WorkflowStudioTriggerSectionEditor
        sharedDraft={sharedDraft}
        draftValidationIssues={draftValidationIssues}
        onUpdateSharedDraft={onUpdateSharedDraft}
      />

      <WorkflowStudioInputSectionEditor
        sharedDraft={sharedDraft}
        draftValidationIssues={draftValidationIssues}
        onUpdateSharedDraft={onUpdateSharedDraft}
        studioId={studioId}
        routeSearch={routeSearch}
        onReplaceRouteSearch={onReplaceRouteSearch}
      />

      <WorkflowStudioStepSectionEditor
        sharedDraft={sharedDraft}
        draftValidationIssues={draftValidationIssues}
        onUpdateSharedDraft={onUpdateSharedDraft}
        studioId={studioId}
        routeSearch={routeSearch}
      />

      <WorkflowStudioOutputSectionEditor
        sharedDraft={sharedDraft}
        draftValidationIssues={draftValidationIssues}
        onUpdateSharedDraft={onUpdateSharedDraft}
      />

      <section
        id="workflow-wizard-terminal-actions"
        className="ui-card ui-card--padded ui-stack ui-stack--2xs"
        data-testid="workflow-wizard-terminal-actions"
      >
        <strong>Finish and continue</strong>
        {progress.isWorkflowReady ? (
          <p className="ui-text-muted">
            Ready to Save / Ready to Run: all sections are complete and validation-ready for this draft slice.
          </p>
        ) : (
          <p className="ui-text-muted">
            Continue refining required sections before save/run. Completed: {progress.completedSectionCount}/{progress.sections.length}.
          </p>
        )}
        <div className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }}>
          {firstIncompleteSection ? (
            <a
              className="ui-button ui-button--ghost ui-button--sm"
              href={`#${firstIncompleteSection.anchorId}`}
              data-testid="workflow-wizard-jump-incomplete"
            >
              Jump to first incomplete
            </a>
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
            disabled={!progress.isWorkflowReady}
            data-testid="workflow-wizard-ready-action"
          >
            Ready to Save / Run
          </button>
        </div>
      </section>

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
        <textarea id="workflow-wizard-json-preview" className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
      </label>
    </div>
  );
}
