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
import ExperienceAssetAuthoringBoundary from "../experience-assets/ExperienceAssetAuthoringBoundary";
import { ExperienceAssetModeIds, type ExperienceAssetDefinition } from "../../../studio-shell/experience-assets/ExperienceAssetContracts";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";

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
  readonly experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>;
  readonly hostMode?: StudioAssetRenderMode;
}

function buildWorkflowExperienceDefinition(
  experienceAssetIds?: ReadonlyArray<ExperienceSurfaceAssetId>,
): ExperienceAssetDefinition<WorkflowDraft, WorkflowValidationIssue> {
  const fallbackModes = Object.freeze([
    Object.freeze({
      id: ExperienceAssetModeIds.wizard,
      title: "Wizard",
      summary: "Guided step-by-step workflow authoring.",
      intent: "guided-authoring",
    }),
    Object.freeze({
      id: ExperienceAssetModeIds.canvas,
      title: "Canvas",
      summary: "Graph-oriented workflow authoring.",
      intent: "graph-authoring",
    }),
  ]);
  const resolvedModeIds = new Set(
    resolveExperienceAssetModesFromRegistrations({
      assetIds: experienceAssetIds,
      fallbackModes,
    }).map((mode) => mode.id),
  );

  const modes = fallbackModes.filter((mode) => resolvedModeIds.has(mode.id));
  const hasWizard = modes.some((mode) => mode.id === ExperienceAssetModeIds.wizard);
  const hasCanvas = modes.some((mode) => mode.id === ExperienceAssetModeIds.canvas);

  return Object.freeze({
    id: "workflow-studio",
    title: "Workflow Studio",
    defaultModeId: hasWizard ? ExperienceAssetModeIds.wizard : ExperienceAssetModeIds.canvas,
    modes: Object.freeze(modes),
    wizard: hasWizard
      ? Object.freeze({
        id: "wizard",
        title: "Wizard",
        summary: "Guided step-by-step workflow authoring.",
      })
      : undefined,
    canvas: hasCanvas
      ? Object.freeze({
        id: "canvas",
        title: "Canvas",
        summary: "Graph-oriented workflow authoring.",
        supportsNodePalette: true,
      })
      : undefined,
  });
}

const defaultWorkflowExperienceAssetIds = Object.freeze([
  ExperienceSurfaceAssetIds.loomWizard,
  ExperienceSurfaceAssetIds.loomCanvas,
]);

export default function WorkflowStudioDraftAuthoringBoundary({
  isWorkflowStudio,
  content,
  onChangeContent,
  workflowModeContext,
  invalidModeRouteId,
  invalidWizardPageRouteId,
  experienceAssetIds = defaultWorkflowExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
}: WorkflowStudioDraftAuthoringBoundaryProps): JSX.Element {
  if (!isWorkflowStudio || !workflowModeContext) {
    return <textarea className="ui-textarea" rows={8} value={content} onChange={(event) => onChangeContent(event.target.value)} />;
  }

  return (
    <>
      <ExperienceAssetAuthoringBoundary
        asset={buildWorkflowExperienceDefinition(experienceAssetIds)}
        currentModeId={workflowModeContext.selectedModeId}
        invalidRequestedModeId={invalidModeRouteId}
        document={workflowModeContext.sharedDraft}
        issues={workflowModeContext.draftValidationIssues}
        surfaces={{
          wizard: () => (
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
          ),
          canvas: () => (
            <WorkflowStudioCanvasModeLayout>
              <WorkflowStudioCanvasModeSurface
                studioId={workflowModeContext.studioId}
                sharedDraft={workflowModeContext.sharedDraft}
                draftValidationIssues={workflowModeContext.draftValidationIssues}
                onUpdateSharedDraft={workflowModeContext.updateSharedDraft}
                draftEditorContent={workflowModeContext.draftEditorContent}
                onChangeDraftEditorContent={onChangeContent}
                drawerState={workflowModeContext.canvasDrawers}
              />
            </WorkflowStudioCanvasModeLayout>
          ),
        }}
      />

      {hostMode === StudioAssetRenderModes.full && invalidWizardPageRouteId ? (
        <p className="ui-text-muted">
          Unsupported wizard page route &quot;{invalidWizardPageRouteId}&quot;; using {workflowModeContext.selectedWizardPageId} page.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext.draftParseError ? (
        <p className="ui-text-muted">
          Workflow draft content must be valid canonical workflow JSON before saving.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext.modeValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Workflow mode validation: {workflowModeContext.modeValidationIssues.length} issue(s) detected.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext.draftValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Shared workflow draft validation: {workflowModeContext.draftValidationIssues.length} canonical issue(s) detected.
        </p>
      ) : null}
    </>
  );
}
