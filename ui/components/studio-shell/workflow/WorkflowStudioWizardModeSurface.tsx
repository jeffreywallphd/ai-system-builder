import { useEffect, useState } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import {
  WorkflowWizardSectionIds,
  deriveWorkflowWizardProgress,
} from "../../../studio-shell/workflow/WorkflowStudioWizardProgress";
import type { WorkflowStudioWizardPageId } from "../../../studio-shell/workflow/WorkflowStudioWizardRouting";
import type { WorkflowStudioHandoffStatus } from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";
import WorkflowStudioHandoffStatusBanner from "./WorkflowStudioHandoffStatusBanner";
import ConfigurableWizardSurface from "../experience-assets/ConfigurableWizardSurface";
import { buildWorkflowWizardExperienceAdapterModel } from "../../../studio-shell/workflow/WorkflowWizardExperienceAdapter";

export interface WorkflowStudioWizardModeSurfaceProps {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftValidationIssues?: ReadonlyArray<WorkflowValidationIssue>;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly studioId?: string;
  readonly selectedWizardPageId: WorkflowStudioWizardPageId;
  readonly onSelectWizardPage?: (pageId: WorkflowStudioWizardPageId) => void;
  readonly handoffStatus?: WorkflowStudioHandoffStatus;
  readonly onSetHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
  readonly onClearHandoffStatus?: () => void;
}

export default function WorkflowStudioWizardModeSurface({
  sharedDraft,
  sharedDraftSerialized,
  draftValidationIssues = [],
  onUpdateSharedDraft,
  studioId,
  selectedWizardPageId,
  onSelectWizardPage,
  handoffStatus,
  onSetHandoffStatus,
  onClearHandoffStatus,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  const [readyActionAttempted, setReadyActionAttempted] = useState(false);
  const [readyActionConfirmed, setReadyActionConfirmed] = useState(false);
  const adapterModel = buildWorkflowWizardExperienceAdapterModel({
    sharedDraft,
    sharedDraftSerialized,
    draftValidationIssues,
    selectedWizardPageId,
    studioId,
    onUpdateSharedDraft,
    onSelectWizardPage,
    onSetHandoffStatus,
    readyActionAttempted,
    readyActionConfirmed,
    onReadyAction: () => {
      setReadyActionAttempted(true);
      const isWorkflowReady = deriveWorkflowWizardProgress(sharedDraft, draftValidationIssues).isWorkflowReady;
      if (!isWorkflowReady) {
        setReadyActionConfirmed(false);
        return;
      }
      setReadyActionConfirmed(true);
    },
  });

  useEffect(() => {
    if (!adapterModel.context.progress.isWorkflowReady) {
      setReadyActionConfirmed(false);
    }
  }, [adapterModel.context.progress.isWorkflowReady]);

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <WorkflowStudioHandoffStatusBanner
        status={handoffStatus}
        onDismiss={onClearHandoffStatus}
      />

      <ConfigurableWizardSurface
        definition={adapterModel.definition}
        definitionContext={adapterModel.context}
        activePageId={adapterModel.activePageId}
        onSelectPage={(pageId) => onSelectWizardPage?.(pageId as WorkflowStudioWizardPageId)}
        pageNavigationTestIds={{
          back: "workflow-wizard-back-page",
          next: "workflow-wizard-next-page",
        }}
      />

      {adapterModel.activePageId === WorkflowWizardSectionIds.trigger ? (
        <div className="ui-configurable-wizard__navigation-actions ui-configurable-wizard__navigation-actions--inline">
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            data-testid="workflow-wizard-back-page-trigger"
            disabled
          >
            Back
          </button>
          <button
            type="button"
            className="ui-button ui-button--primary ui-button--sm"
            data-testid="workflow-wizard-next-page-trigger"
            onClick={() => onSelectWizardPage?.(WorkflowWizardSectionIds.inputs)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
