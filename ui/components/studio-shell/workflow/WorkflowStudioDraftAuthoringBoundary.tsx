import { useMemo, useState } from "react";
import type { WorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
  validateWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioModeId } from "../../../studio-shell/workflow/WorkflowStudioModes";
import WorkflowStudioCanvasExperienceSurface from "./WorkflowStudioCanvasExperienceSurface";
import WorkflowStudioWizardExperienceSurface from "./WorkflowStudioWizardExperienceSurface";
import type { WorkflowStudioModeValidationIssue } from "../../../studio-shell/workflow/WorkflowStudioModeValidation";
import type { WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import type { WorkflowStudioWizardPageId } from "../../../studio-shell/workflow/WorkflowStudioWizardRouting";
import type { WorkflowStudioHandoffStatus } from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";
import { ExperienceAssetModeIds, type ExperienceAssetDefinition, type ExperienceAssetModeDefinition } from "../../../studio-shell/experience-assets/ExperienceAssetContracts";
import {
  ExperienceSurfaceAssetIds,
  resolveExperienceAssetModesFromRegistrations,
  type ExperienceSurfaceAssetId,
} from "../../../studio-shell/experience-assets/ExperienceSurfaceAssets";
import { StudioAssetRenderModes, type StudioAssetRenderMode } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import {
  StudioEmbeddedIntentKinds,
  createStudioIntentEvent,
  type StudioEmbeddedEvent,
} from "../../../studio-shell/studio-assets/StudioEmbeddedEventContracts";

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
  readonly onStudioEvent?: (event: StudioEmbeddedEvent) => void;
  readonly embeddedVariant?: "behavior-automation";
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
  onStudioEvent,
  embeddedVariant,
}: WorkflowStudioDraftAuthoringBoundaryProps): JSX.Element {
  if (!isWorkflowStudio) {
    return <textarea className="ui-textarea" rows={8} value={content} onChange={(event) => onChangeContent(event.target.value)} />;
  }

  if (!workflowModeContext) {
    return (
      <WorkflowStudioEmbeddedAuthoringBoundary
        content={content}
        onChangeContent={onChangeContent}
        invalidModeRouteId={invalidModeRouteId}
        invalidWizardPageRouteId={invalidWizardPageRouteId}
        experienceAssetIds={experienceAssetIds}
        hostMode={hostMode}
        onStudioEvent={onStudioEvent}
        embeddedVariant={embeddedVariant}
      />
    );
  }

  return WorkflowStudioModeSurfaceRenderer({
    onChangeContent,
    workflowModeContext,
    invalidModeRouteId,
    invalidWizardPageRouteId,
    experienceAssetIds,
    hostMode,
    onStudioEvent,
    embeddedVariant,
  });
}

function WorkflowStudioEmbeddedAuthoringBoundary({
  content,
  onChangeContent,
  invalidModeRouteId,
  invalidWizardPageRouteId,
  experienceAssetIds,
  hostMode,
  onStudioEvent,
  embeddedVariant,
}: Omit<WorkflowStudioDraftAuthoringBoundaryProps, "isWorkflowStudio" | "workflowModeContext">): JSX.Element {
  const [embeddedWizardPageId, setEmbeddedWizardPageId] = useState<WorkflowStudioWizardPageId>(
    embeddedVariant === "behavior-automation" ? "steps" : "trigger",
  );
  const embeddedModeContext = useMemo<NonNullable<WorkflowStudioDraftAuthoringBoundaryProps["workflowModeContext"]>>(() => {
    let sharedDraft = createEmptyWorkflowDraft();
    let draftParseError: string | undefined;
    if (content.trim().length > 0) {
      try {
        sharedDraft = deserializeWorkflowDraft(content);
      } catch (error) {
        draftParseError = error instanceof Error ? error.message : "Workflow draft is malformed.";
      }
    }
    const draftValidation = validateWorkflowDraft(sharedDraft);
    const sharedDraftSerialized = serializeWorkflowDraft(sharedDraft);
    return Object.freeze({
      selectedModeId: "wizard",
      selectedWizardPageId: embeddedWizardPageId,
      sharedDraft,
      sharedDraftSerialized,
      draftEditorContent: content,
      draftParseError,
      modeValidationIssues: Object.freeze([]),
      draftValidationIssues: Object.freeze(draftValidation.issues),
      updateSharedDraft: (updater: (draft: WorkflowDraft) => WorkflowDraft) => {
        onChangeContent(serializeWorkflowDraft(updater(sharedDraft)));
        onStudioEvent?.(createStudioIntentEvent({
          kind: StudioEmbeddedIntentKinds.applyRequest,
          payload: Object.freeze({ scope: "changes" }),
        }));
      },
      onSelectWizardPage: (pageId: WorkflowStudioWizardPageId) => {
        setEmbeddedWizardPageId(pageId);
      },
    });
  }, [content, embeddedWizardPageId, onChangeContent, onStudioEvent]);

  return WorkflowStudioModeSurfaceRenderer({
    onChangeContent,
    workflowModeContext: embeddedModeContext,
    invalidModeRouteId,
    invalidWizardPageRouteId,
    experienceAssetIds,
    hostMode,
    onStudioEvent,
    embeddedVariant,
  });
}

function WorkflowStudioModeSurfaceRenderer({
  onChangeContent,
  workflowModeContext,
  invalidModeRouteId,
  invalidWizardPageRouteId,
  experienceAssetIds = defaultWorkflowExperienceAssetIds,
  hostMode = StudioAssetRenderModes.full,
  onStudioEvent,
  embeddedVariant,
}: Omit<WorkflowStudioDraftAuthoringBoundaryProps, "isWorkflowStudio" | "content"> & {
  readonly workflowModeContext: NonNullable<WorkflowStudioDraftAuthoringBoundaryProps["workflowModeContext"]>;
}): JSX.Element {
  const resolvedWorkflowModeContext = workflowModeContext;
  const constrainedExperienceAssetIds = embeddedVariant === "behavior-automation"
    ? Object.freeze([ExperienceSurfaceAssetIds.loomWizard] as const)
    : experienceAssetIds;
  const experience = buildWorkflowExperienceDefinition(constrainedExperienceAssetIds);
  const activeMode = experience.modes.find((mode) => mode.id === resolvedWorkflowModeContext.selectedModeId)
    ?? experience.modes.find((mode) => mode.id === experience.defaultModeId)
    ?? experience.modes[0];
  const unsupportedModeId = invalidModeRouteId;

  const renderWorkflowModeSurface = (mode: ExperienceAssetModeDefinition): JSX.Element => {
    if (mode.id === ExperienceAssetModeIds.wizard) {
      return (
        <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-wizard-experience-surface">
          {WorkflowStudioWizardExperienceSurface({
            studioId: resolvedWorkflowModeContext.studioId,
            selectedWizardPageId: resolvedWorkflowModeContext.selectedWizardPageId,
            onSelectWizardPage: (pageId) => {
              resolvedWorkflowModeContext.onSelectWizardPage?.(pageId);
              onStudioEvent?.(createStudioIntentEvent({
                kind: StudioEmbeddedIntentKinds.selectionChange,
                payload: Object.freeze({
                  targetType: "wizard-page",
                  targetId: pageId,
                }),
              }));
            },
            sharedDraft: resolvedWorkflowModeContext.sharedDraft,
            sharedDraftSerialized: resolvedWorkflowModeContext.sharedDraftSerialized,
            draftValidationIssues: resolvedWorkflowModeContext.draftValidationIssues,
            onUpdateSharedDraft: resolvedWorkflowModeContext.updateSharedDraft,
            handoffStatus: resolvedWorkflowModeContext.handoffStatus,
            onSetHandoffStatus: resolvedWorkflowModeContext.setHandoffStatus,
            onClearHandoffStatus: resolvedWorkflowModeContext.clearHandoffStatus,
          })}
        </section>
      );
    }

    return (
      <section className="ui-stack ui-stack--xs" data-testid="workflow-studio-canvas-experience-surface">
        {WorkflowStudioCanvasExperienceSurface({
          studioId: resolvedWorkflowModeContext.studioId,
          sharedDraft: resolvedWorkflowModeContext.sharedDraft,
          draftValidationIssues: resolvedWorkflowModeContext.draftValidationIssues,
          onUpdateSharedDraft: resolvedWorkflowModeContext.updateSharedDraft,
          draftEditorContent: resolvedWorkflowModeContext.draftEditorContent,
          onChangeDraftEditorContent: onChangeContent,
          drawerState: resolvedWorkflowModeContext.canvasDrawers,
        })}
      </section>
    );
  };

  return (
    <>
      {activeMode ? renderWorkflowModeSurface(activeMode) : (
        <p className="ui-text-muted">No authoring modes are configured for this workflow experience.</p>
      )}

      {activeMode && unsupportedModeId ? (
        <p className="ui-text-muted">
          Unsupported experience mode selection &quot;{unsupportedModeId}&quot;; using {activeMode.id} mode.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext && invalidWizardPageRouteId ? (
        <p className="ui-text-muted">
          Unsupported wizard page route &quot;{invalidWizardPageRouteId}&quot;; using {resolvedWorkflowModeContext.selectedWizardPageId} page.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext && resolvedWorkflowModeContext.draftParseError ? (
        <p className="ui-text-muted">
          Workflow draft content must be valid canonical workflow JSON before saving.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext && resolvedWorkflowModeContext.modeValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Workflow mode validation: {resolvedWorkflowModeContext.modeValidationIssues.length} issue(s) detected.
        </p>
      ) : null}

      {hostMode === StudioAssetRenderModes.full && workflowModeContext && resolvedWorkflowModeContext.draftValidationIssues.length > 0 ? (
        <p className="ui-text-muted">
          Shared workflow draft validation: {resolvedWorkflowModeContext.draftValidationIssues.length} canonical issue(s) detected.
        </p>
      ) : null}
    </>
  );
}
