import type { JSX } from "react";
import type { WorkflowDraft, WorkflowValidationIssue } from "@domain/workflow-studio/WorkflowStudioDomain";
import type {
  WizardExperienceAssetDefinition,
} from "../experience-assets/ConfigurableWizardSurfaceContracts";
import {
  WorkflowWizardSectionIds,
  deriveWorkflowWizardProgress,
  type WorkflowWizardSectionId,
} from "./WorkflowStudioWizardProgress";
import { listWorkflowOutputSummaries, type WorkflowOutputSummary } from "./WorkflowWizardOutputs";
import type { WorkflowStudioWizardPageId } from "./WorkflowStudioWizardRouting";
import WorkflowStudioInputSectionEditor from "../../components/studio-shell/workflow/WorkflowStudioInputSectionEditor";
import WorkflowStudioOutputSectionEditor from "../../components/studio-shell/workflow/WorkflowStudioOutputSectionEditor";
import WorkflowStudioStepSectionEditor from "../../components/studio-shell/workflow/WorkflowStudioStepSectionEditor";
import WorkflowStudioTriggerSectionEditor from "../../components/studio-shell/workflow/WorkflowStudioTriggerSectionEditor";
import type { WorkflowStudioHandoffStatus } from "./WorkflowStudioHandoffStatus";

export interface WorkflowWizardExperienceAdapterInput {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly selectedWizardPageId: WorkflowStudioWizardPageId;
  readonly studioId?: string;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly onSelectWizardPage?: (pageId: WorkflowStudioWizardPageId) => void;
  readonly onSetHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
  readonly readyActionAttempted: boolean;
  readonly readyActionConfirmed: boolean;
  readonly onReadyAction: () => void;
}

export interface WorkflowWizardExperienceAdapterModel {
  readonly definition: WizardExperienceAssetDefinition<WorkflowWizardExperienceContext>;
  readonly context: WorkflowWizardExperienceContext;
  readonly activePageId: WorkflowStudioWizardPageId;
  readonly firstIncompleteSectionId?: WorkflowWizardSectionId;
}

export interface WorkflowWizardExperienceContext {
  readonly sharedDraft: WorkflowDraft;
  readonly sharedDraftSerialized: string;
  readonly draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>;
  readonly studioId?: string;
  readonly onUpdateSharedDraft?: (updater: (draft: WorkflowDraft) => WorkflowDraft) => void;
  readonly onSetHandoffStatus?: (status: WorkflowStudioHandoffStatus) => void;
  readonly progress: ReturnType<typeof deriveWorkflowWizardProgress>;
  readonly outputSummaries: ReadonlyArray<WorkflowOutputSummary>;
  readonly readyActionAttempted: boolean;
  readonly readyActionConfirmed: boolean;
  readonly onReadyAction: () => void;
  readonly onSelectPage: (pageId: WorkflowStudioWizardPageId) => void;
}

function isWorkflowWizardSectionId(value: string): value is WorkflowWizardSectionId {
  return (
    value === WorkflowWizardSectionIds.trigger
    || value === WorkflowWizardSectionIds.inputs
    || value === WorkflowWizardSectionIds.steps
    || value === WorkflowWizardSectionIds.outputs
  );
}

function renderTriggerPage(context: WorkflowWizardExperienceContext): JSX.Element {
  return (
    <div className="ui-stack ui-stack--2xs" data-testid="workflow-wizard-page-trigger">
      <WorkflowStudioTriggerSectionEditor
        sharedDraft={context.sharedDraft}
        draftValidationIssues={context.draftValidationIssues}
        onUpdateSharedDraft={context.onUpdateSharedDraft}
      />
    </div>
  );
}

function renderInputsPage(context: WorkflowWizardExperienceContext): JSX.Element {
  return (
    <div data-testid="workflow-wizard-page-inputs">
      <WorkflowStudioInputSectionEditor
        sharedDraft={context.sharedDraft}
        draftValidationIssues={context.draftValidationIssues}
        onUpdateSharedDraft={context.onUpdateSharedDraft}
        studioId={context.studioId}
        onSetHandoffStatus={context.onSetHandoffStatus}
      />
    </div>
  );
}

function renderStepsPage(context: WorkflowWizardExperienceContext): JSX.Element {
  return (
    <div data-testid="workflow-wizard-page-steps">
      <WorkflowStudioStepSectionEditor
        sharedDraft={context.sharedDraft}
        draftValidationIssues={context.draftValidationIssues}
        onUpdateSharedDraft={context.onUpdateSharedDraft}
        studioId={context.studioId}
        onSetHandoffStatus={context.onSetHandoffStatus}
      />
    </div>
  );
}

function renderOutputsPage(context: WorkflowWizardExperienceContext): JSX.Element {
  return (
    <div data-testid="workflow-wizard-page-outputs">
      <WorkflowStudioOutputSectionEditor
        sharedDraft={context.sharedDraft}
        draftValidationIssues={context.draftValidationIssues}
        onUpdateSharedDraft={context.onUpdateSharedDraft}
      />
    </div>
  );
}

function renderOutputsTerminalArea(context: WorkflowWizardExperienceContext): JSX.Element {
  const firstIncompleteSection = context.progress.firstIncompleteSectionId
    ? context.progress.sections.find((section) => section.id === context.progress.firstIncompleteSectionId)
    : undefined;

  return (
    <>
      <section
        id="workflow-wizard-terminal-actions"
        className="ui-card ui-card--padded ui-stack ui-stack--2xs"
        data-testid="workflow-wizard-terminal-actions"
      >
        <strong>Prepare for run handoff</strong>
        {context.progress.isWorkflowReady ? (
          <p className="ui-text-muted">
            Ready for next-stage handoff. Save and continue to lifecycle/publish controls.
          </p>
        ) : (
          <p className="ui-text-muted">
            Resolve remaining blockers before handoff. Completed: {context.progress.completedSectionCount}/{context.progress.sections.length}.
          </p>
        )}
        {context.readyActionAttempted && !context.progress.isWorkflowReady ? (
          <p className="ui-text-danger" data-testid="workflow-wizard-ready-blocked">
            Cannot prepare for run yet. Resolve the blocking sections listed above.
          </p>
        ) : null}
        {context.readyActionConfirmed ? (
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
              onClick={() => context.onSelectPage(firstIncompleteSection.id)}
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
            onClick={context.onReadyAction}
            data-testid="workflow-wizard-ready-action"
          >
            Prepare for Run
          </button>
        </div>
        <div className="ui-stack ui-stack--2xs ui-workflow-wizard__output-overview" data-testid="workflow-wizard-output-overview">
          <strong>Configured outputs</strong>
          {context.outputSummaries.length > 0 ? (
            <ul className="ui-stack ui-stack--2xs ui-workflow-wizard__output-summary-list">
              {context.outputSummaries.map((summary) => (
                <li key={summary.outputId} className="ui-workflow-wizard__output-summary-item">
                  <div><strong>{summary.order}. {summary.displayLabel}</strong> <span className="ui-text-secondary">({summary.typeLabel})</span></div>
                  {summary.detailLines.length > 0 ? (
                    <div className="ui-text-small ui-text-secondary">{summary.detailLines.join(" Â· ")}</div>
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
        <textarea id="workflow-wizard-json-preview" className="ui-textarea" rows={8} value={context.sharedDraftSerialized} readOnly />
      </label>
    </>
  );
}

const workflowWizardExperienceDefinition: WizardExperienceAssetDefinition<WorkflowWizardExperienceContext> = Object.freeze({
  id: "workflow-authoring-wizard",
  title: "Workflow authoring wizard",
  summary: "Guided authoring flow for canonical workflow drafts.",
  pages: Object.freeze([
    Object.freeze({
      id: WorkflowWizardSectionIds.trigger,
      title: "Trigger",
      summary: "Configure workflow start conditions.",
      resolveStatus: (context) => context.progress.sections.find((section) => section.id === WorkflowWizardSectionIds.trigger)?.statusLabel,
      render: renderTriggerPage,
    }),
    Object.freeze({
      id: WorkflowWizardSectionIds.inputs,
      title: "Inputs",
      summary: "Configure canonical workflow inputs.",
      resolveStatus: (context) => context.progress.sections.find((section) => section.id === WorkflowWizardSectionIds.inputs)?.statusLabel,
      render: renderInputsPage,
    }),
    Object.freeze({
      id: WorkflowWizardSectionIds.steps,
      title: "Steps",
      summary: "Configure workflow execution steps.",
      resolveStatus: (context) => context.progress.sections.find((section) => section.id === WorkflowWizardSectionIds.steps)?.statusLabel,
      render: renderStepsPage,
    }),
    Object.freeze({
      id: WorkflowWizardSectionIds.outputs,
      title: "Outputs",
      summary: "Configure workflow outputs and handoff readiness.",
      resolveStatus: (context) => context.progress.sections.find((section) => section.id === WorkflowWizardSectionIds.outputs)?.statusLabel,
      render: renderOutputsPage,
    }),
  ]),
  resolveProgress: ({ context, activePageId }) => {
    const activeSection = context.progress.sections.find((section) => section.id === activePageId) ?? context.progress.sections[0];
    return Object.freeze({
      totalCount: context.progress.sections.length,
      completeCount: context.progress.completedSectionCount,
      readyCount: context.progress.readySectionCount,
      focusLabel: activeSection?.title ?? "Trigger",
    });
  },
  resolveReadiness: (context) => Object.freeze({
    title: "Workflow readiness summary",
    description: context.progress.isWorkflowReady
      ? "Workflow draft is ready for handoff."
      : `Workflow draft is not ready yet. ${context.progress.blockingIssueCount} blocking item(s) remain. Inputs policy: ${context.progress.readinessPolicy.inputs === "required" ? "required for this wizard pass" : "optional"}.`,
    issues: Object.freeze(context.progress.blockingIssues.map((issue) => Object.freeze({
      id: issue.id,
      message: `${issue.sectionTitle}: ${issue.message}`,
      pageId: issue.sectionId,
    }))),
  }),
  renderTerminalArea: ({ context, activePageId }) => (
    activePageId === WorkflowWizardSectionIds.outputs ? renderOutputsTerminalArea(context) : null
  ),
  navigationPolicy: Object.freeze({
    sequentialNavigation: "enabled",
  }),
});

export function buildWorkflowWizardExperienceAdapterModel(
  input: WorkflowWizardExperienceAdapterInput,
): WorkflowWizardExperienceAdapterModel {
  const progress = deriveWorkflowWizardProgress(input.sharedDraft, input.draftValidationIssues);
  const outputSummaries = listWorkflowOutputSummaries(input.sharedDraft);
  const orderedPageIds = progress.sections
    .map((section) => section.id)
    .filter((sectionId): sectionId is WorkflowWizardSectionId => isWorkflowWizardSectionId(sectionId));

  const activePageId = orderedPageIds.includes(input.selectedWizardPageId)
    ? input.selectedWizardPageId
    : orderedPageIds[0] ?? WorkflowWizardSectionIds.trigger;

  const onSelectPage = (pageId: WorkflowStudioWizardPageId): void => {
    input.onSelectWizardPage?.(pageId);
  };

  return Object.freeze({
    definition: workflowWizardExperienceDefinition,
    context: Object.freeze({
      sharedDraft: input.sharedDraft,
      sharedDraftSerialized: input.sharedDraftSerialized,
      draftValidationIssues: input.draftValidationIssues,
      studioId: input.studioId,
      onUpdateSharedDraft: input.onUpdateSharedDraft,
      onSetHandoffStatus: input.onSetHandoffStatus,
      progress,
      outputSummaries,
      readyActionAttempted: input.readyActionAttempted,
      readyActionConfirmed: input.readyActionConfirmed,
      onReadyAction: input.onReadyAction,
      onSelectPage,
    }),
    activePageId,
    firstIncompleteSectionId: progress.firstIncompleteSectionId,
  });
}

