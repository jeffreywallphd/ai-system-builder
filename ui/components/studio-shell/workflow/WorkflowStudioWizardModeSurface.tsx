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
import type { WorkflowStudioHandoffStatus } from "../../../studio-shell/workflow/WorkflowStudioHandoffStatus";
import WorkflowStudioHandoffStatusBanner from "./WorkflowStudioHandoffStatusBanner";
import { listWorkflowOutputSummaries } from "../../../studio-shell/workflow/WorkflowWizardOutputs";
import ConfigurableWizardSurface from "../experience-assets/ConfigurableWizardSurface";

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
  handoffStatus,
  onSetHandoffStatus,
  onClearHandoffStatus,
}: WorkflowStudioWizardModeSurfaceProps): JSX.Element {
  const [readyActionAttempted, setReadyActionAttempted] = useState(false);
  const [readyActionConfirmed, setReadyActionConfirmed] = useState(false);
  const progress = deriveWorkflowWizardProgress(sharedDraft, draftValidationIssues);
  const outputSummaries = useMemo(() => listWorkflowOutputSummaries(sharedDraft), [sharedDraft]);

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

  const renderPageHost = (pageId: string): JSX.Element => {
    if (pageId === WorkflowWizardSectionIds.trigger) {
      return (
        <div className="ui-stack ui-stack--2xs" data-testid="workflow-wizard-page-trigger">
          <WorkflowStudioTriggerSectionEditor
            sharedDraft={sharedDraft}
            draftValidationIssues={draftValidationIssues}
            onUpdateSharedDraft={onUpdateSharedDraft}
          />
        </div>
      );
    }

    if (pageId === WorkflowWizardSectionIds.inputs) {
      return (
        <div data-testid="workflow-wizard-page-inputs">
          <WorkflowStudioInputSectionEditor
            sharedDraft={sharedDraft}
            draftValidationIssues={draftValidationIssues}
            onUpdateSharedDraft={onUpdateSharedDraft}
            studioId={studioId}
            onSetHandoffStatus={onSetHandoffStatus}
          />
        </div>
      );
    }

    if (pageId === WorkflowWizardSectionIds.steps) {
      return (
        <div data-testid="workflow-wizard-page-steps">
          <WorkflowStudioStepSectionEditor
            sharedDraft={sharedDraft}
            draftValidationIssues={draftValidationIssues}
            onUpdateSharedDraft={onUpdateSharedDraft}
            studioId={studioId}
            onSetHandoffStatus={onSetHandoffStatus}
          />
        </div>
      );
    }

    return (
      <div data-testid="workflow-wizard-page-outputs">
        <WorkflowStudioOutputSectionEditor
          sharedDraft={sharedDraft}
          draftValidationIssues={draftValidationIssues}
          onUpdateSharedDraft={onUpdateSharedDraft}
        />
      </div>
    );
  };

  return (
    <div className="ui-stack ui-stack--sm" data-testid="workflow-studio-wizard-mode-surface">
      <WorkflowStudioHandoffStatusBanner
        status={handoffStatus}
        onDismiss={onClearHandoffStatus}
      />

      <ConfigurableWizardSurface
        pages={progress.sections.map((section) => ({
          id: section.id,
          title: section.title,
          status: section.statusLabel,
        }))}
        activePageId={activePageId}
        onSelectPage={(pageId) => selectPage(pageId as WorkflowStudioWizardPageId)}
        progress={{
          totalCount: progress.sections.length,
          completeCount: progress.completedSectionCount,
          readyCount: progress.readySectionCount,
          focusLabel: activeSection?.title ?? "Trigger",
        }}
        readiness={{
          title: "Workflow readiness summary",
          description: progress.isWorkflowReady
            ? "Workflow draft is ready for handoff."
            : `Workflow draft is not ready yet. ${progress.blockingIssueCount} blocking item(s) remain. Inputs policy: ${progress.readinessPolicy.inputs === "required" ? "required for this wizard pass" : "optional"}.`,
          issues: progress.blockingIssues.map((issue) => ({
            id: issue.id,
            message: `${issue.sectionTitle}: ${issue.message}`,
            pageId: issue.sectionId,
          })),
        }}
        pageNavigationTestIds={{
          back: "workflow-wizard-back-page",
          next: "workflow-wizard-next-page",
        }}
        renderPageHost={renderPageHost}
        renderTerminalArea={(pageId) => pageId === WorkflowWizardSectionIds.outputs ? (
          <>
            <section
              id="workflow-wizard-terminal-actions"
              className="ui-card ui-card--padded ui-stack ui-stack--2xs"
              data-testid="workflow-wizard-terminal-actions"
            >
              <strong>Prepare for run handoff</strong>
              {progress.isWorkflowReady ? (
                <p className="ui-text-muted">
                  Ready for next-stage handoff. Save and continue to lifecycle/publish controls.
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
              <div className="ui-row ui-row--wrap ui-configurable-wizard__terminal-actions-row">
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
              <div className="ui-stack ui-stack--2xs ui-workflow-wizard__output-overview" data-testid="workflow-wizard-output-overview">
                <strong>Configured outputs</strong>
                {outputSummaries.length > 0 ? (
                  <ul className="ui-stack ui-stack--2xs ui-workflow-wizard__output-summary-list">
                    {outputSummaries.map((summary) => (
                      <li key={summary.outputId} className="ui-workflow-wizard__output-summary-item">
                        <div><strong>{summary.order}. {summary.displayLabel}</strong> <span className="ui-text-secondary">({summary.typeLabel})</span></div>
                        {summary.detailLines.length > 0 ? (
                          <div className="ui-text-small ui-text-secondary">{summary.detailLines.join(" · ")}</div>
                        ) : (
                          <div className="ui-text-small ui-text-secondary">No additional output details configured.</div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ui-text-muted">No outputs configured yet.</p>
                )}
              </div>
            </section>

            <label className="ui-stack ui-stack--2xs">
              <span className="ui-text-small">Shared canonical workflow draft JSON preview</span>
              <textarea id="workflow-wizard-json-preview" className="ui-textarea" rows={8} value={sharedDraftSerialized} readOnly />
            </label>
          </>
        ) : null}
      />

      {activePageId === WorkflowWizardSectionIds.trigger ? (
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
            onClick={() => selectPage(WorkflowWizardSectionIds.inputs)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
