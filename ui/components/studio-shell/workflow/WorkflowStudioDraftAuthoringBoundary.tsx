import type { WorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";
import WorkflowStudioCanvasModeSurface from "./WorkflowStudioCanvasModeSurface";
import WorkflowStudioWizardModeSurface from "./WorkflowStudioWizardModeSurface";
import WorkflowStudioWizardModeLayout from "./WorkflowStudioWizardModeLayout";
import WorkflowStudioCanvasModeLayout from "./WorkflowStudioCanvasModeLayout";
import type { WorkflowStudioModeValidationIssue } from "../../../studio-shell/workflow/WorkflowStudioModeValidation";
import type { WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioWizardPageId } from "../../../studio-shell/workflow/WorkflowStudioWizardRouting";
import type { WorkflowStudioHandoffStatus } from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";

export interface WorkflowStudioDraftAuthoringBoundaryProps {
  readonly isWorkflowStudio: boolean;
  readonly content: string;
  readonly onChangeContent: (nextContent: string) => void;
  readonly workflowModeContext?: {
    readonly studioId?: string;
    readonly selectedModeId: WorkflowStudioModeId;
    readonly selectedWizardPageId: WorkflowStudioWizardPageId;
    readonly onSelectWizardPage?: (pageId: WorkflowStudioWizardPageId) => void;
    readonly sharedDraft: WorkflowDraft;
    readonly sharedDraftSerialized: string;
    readonly draftEditorContent: string;
    readonly draftParseError?: string;
    readonly modeValidationIssues: ReadonlyArray<WorkflowStudioModeValidationIssue>;
    readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
    readonly updateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
    readonly handoffStatus?: WorkflowStudioHandoffStatus;
    readonly setHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
    readonly clearHandoffStatus?: () => void;
    readonly canvasDrawers?: {
      readonly left?: {
        readonly label: string;
        readonly isOpen: boolean;
        readonly onClose?: () => void;
      };
      readonly right?: {
        readonly label: string;
        readonly isOpen: boolean;
      };
    };
  };
  readonly invalidModeRouteId?: string;
  readonly invalidWizardPageRouteId?: string;
}

export default function WorkflowStudioDraftAuthoringBoundary({
  isWorkflowStudio,
  content,
  onChangeContent,
  workflowModeContext,
  invalidModeRouteId,
  invalidWizardPageRouteId,
}: WorkflowStudioDraftAuthoringBoundaryProps): JSX.Element {
  if (!isWorkflowStudio || !workflowModeContext) {
    return <textarea className="ui-textarea" rows={8} value={content} onChange={(event) => onChangeContent(event.target.value)} />;
  }

  return (
    <>
      {workflowModeContext.selectedModeId === "wizard" ? (
        <WorkflowStudioWizardModeLayout>
          <WorkflowStudioWizardModeSurface
            studioId={workflowModeContext.studioId}
            selectedWizardPageId={workflowModeContext.selectedWizardPageId}
            onSelectWizardPage={workflowModeContext.onSelectWizardPage}
            sharedDraft={workflowModeContext.sharedDraft}
            sharedDraftSerialized={workflowModeContext.sharedDraftSerialized}
            draftValidationIssues={workflowModeContext.draftValidationIssues}
            onUpdateSharedDraft={workflowModeContext.updateSharedDraft}
            handoffStatus={workflowModeContext.handoffStatus}
            onSetHandoffStatus={workflowModeContext.setHandoffStatus}
            onClearHandoffStatus={workflowModeContext.clearHandoffStatus}
          />
        </WorkflowStudioWizardModeLayout>
      ) : (
        <WorkflowStudioCanvasModeLayout>
          <WorkflowStudioCanvasModeSurface
            sharedDraft={workflowModeContext.sharedDraft}
            draftValidationIssues={workflowModeContext.draftValidationIssues}
            onUpdateSharedDraft={workflowModeContext.updateSharedDraft}
            draftEditorContent={workflowModeContext.draftEditorContent}
            onChangeDraftEditorContent={onChangeContent}
            drawerState={workflowModeContext.canvasDrawers}
          />
        </WorkflowStudioCanvasModeLayout>
      )}

      {invalidModeRouteId ? (
        <p className="ui-text-muted">
          Unsupported workflow mode route &quot;{invalidModeRouteId}&quot;; using {workflowModeContext.selectedModeId} mode.
        </p>
      ) : null}

      {invalidWizardPageRouteId ? (
        <p className="ui-text-muted">
          Unsupported wizard page route &quot;{invalidWizardPageRouteId}&quot;; using {workflowModeContext.selectedWizardPageId} page.
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
