import type { WorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";
import WorkflowStudioCanvasModeSurface from "./WorkflowStudioCanvasModeSurface";
import WorkflowStudioWizardModeSurface from "./WorkflowStudioWizardModeSurface";
import WorkflowStudioWizardModeLayout from "./WorkflowStudioWizardModeLayout";
import WorkflowStudioCanvasModeLayout from "./WorkflowStudioCanvasModeLayout";
import type { WorkflowStudioModeValidationIssue } from "../../../studio-shell/workflow/WorkflowStudioModeValidation";
import type { WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";

export interface WorkflowStudioDraftAuthoringBoundaryProps {
  readonly isWorkflowStudio: boolean;
  readonly content: string;
  readonly onChangeContent: (nextContent: string) => void;
  readonly workflowModeContext?: {
    readonly selectedModeId: WorkflowStudioModeId;
    readonly sharedDraft: WorkflowDraft;
    readonly sharedDraftSerialized: string;
    readonly draftEditorContent: string;
    readonly draftParseError?: string;
    readonly modeValidationIssues: ReadonlyArray<WorkflowStudioModeValidationIssue>;
    readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
    readonly updateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  };
  readonly invalidModeRouteId?: string;
}

export default function WorkflowStudioDraftAuthoringBoundary({
  isWorkflowStudio,
  content,
  onChangeContent,
  workflowModeContext,
  invalidModeRouteId,
}: WorkflowStudioDraftAuthoringBoundaryProps): JSX.Element {
  if (!isWorkflowStudio || !workflowModeContext) {
    return <textarea className="ui-textarea" rows={8} value={content} onChange={(event) => onChangeContent(event.target.value)} />;
  }

  return (
    <>
      {workflowModeContext.selectedModeId === "wizard" ? (
        <WorkflowStudioWizardModeLayout>
          <WorkflowStudioWizardModeSurface
            sharedDraft={workflowModeContext.sharedDraft}
            sharedDraftSerialized={workflowModeContext.sharedDraftSerialized}
            draftValidationIssues={workflowModeContext.draftValidationIssues}
            onUpdateSharedDraft={workflowModeContext.updateSharedDraft}
          />
        </WorkflowStudioWizardModeLayout>
      ) : (
        <WorkflowStudioCanvasModeLayout>
          <WorkflowStudioCanvasModeSurface
            draftEditorContent={workflowModeContext.draftEditorContent}
            onChangeDraftEditorContent={onChangeContent}
          />
        </WorkflowStudioCanvasModeLayout>
      )}

      {invalidModeRouteId ? (
        <p className="ui-text-muted">
          Unsupported workflow mode route &quot;{invalidModeRouteId}&quot;; using {workflowModeContext.selectedModeId} mode.
        </p>
      ) : null}

      {workflowModeContext.draftParseError ? (
        <p className="ui-text-muted">
          Workflow draft content must be valid canonical workflow JSON before saving.
        </p>
      ) : null}

      {workflowModeContext.modeValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Workflow mode validation: {workflowModeContext.modeValidationIssues.length} issue(s) detected.
        </p>
      ) : null}

      {workflowModeContext.draftValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Shared workflow draft validation: {workflowModeContext.draftValidationIssues.length} canonical issue(s) detected.
        </p>
      ) : null}
    </>
  );
}
