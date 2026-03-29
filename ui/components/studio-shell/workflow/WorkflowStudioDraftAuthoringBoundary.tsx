import type { WorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";
import WorkflowStudioCanvasModeSurface from "./WorkflowStudioCanvasModeSurface";
import WorkflowStudioWizardModeSurface from "./WorkflowStudioWizardModeSurface";

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
    readonly updateSharedDraft: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
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
        <WorkflowStudioWizardModeSurface
          sharedDraft={workflowModeContext.sharedDraft}
          sharedDraftSerialized={workflowModeContext.sharedDraftSerialized}
          onUpdateSharedDraft={workflowModeContext.updateSharedDraft}
        />
      ) : (
        <WorkflowStudioCanvasModeSurface
          draftEditorContent={workflowModeContext.draftEditorContent}
          onChangeDraftEditorContent={onChangeContent}
        />
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
    </>
  );
}
