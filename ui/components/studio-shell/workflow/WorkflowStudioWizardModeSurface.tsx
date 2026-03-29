import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import WorkflowStudioTriggerSectionEditor from "./WorkflowStudioTriggerSectionEditor";
import WorkflowStudioInputSectionEditor from "./WorkflowStudioInputSectionEditor";
import WorkflowStudioStepSectionEditor from "./WorkflowStudioStepSectionEditor";
import WorkflowStudioOutputSectionEditor from "./WorkflowStudioOutputSectionEditor";

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
  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <nav className="ui-row ui-row--wrap" style={{ gap: "0.5rem" }} aria-label="Wizard sections">
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-trigger">Trigger</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-inputs">Inputs</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-steps">Steps</a>
        <a className="ui-button ui-button--ghost ui-button--sm" href="#workflow-wizard-outputs">Outputs</a>
      </nav>

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

      <label className="ui-stack ui-stack--2xs">
        <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
        <textarea className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
      </label>
    </div>
  );
}
