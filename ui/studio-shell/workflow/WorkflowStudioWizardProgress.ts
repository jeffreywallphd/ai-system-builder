import type { WorkflowDraft, WorkflowValidationIssue } from "../../../domain/workflow-studio/WorkflowStudioDomain";

export const WorkflowWizardSectionIds = Object.freeze({
  trigger: "trigger",
  inputs: "inputs",
  steps: "steps",
  outputs: "outputs",
});

export type WorkflowWizardSectionId = typeof WorkflowWizardSectionIds[keyof typeof WorkflowWizardSectionIds];

export interface WorkflowWizardSectionProgress {
  readonly id: WorkflowWizardSectionId;
  readonly title: string;
  readonly anchorId: string;
  readonly itemCount: number;
  readonly issueCount: number;
  readonly isComplete: boolean;
  readonly isReady: boolean;
  readonly statusLabel: "ready" | "needs-input" | "has-issues";
}

export interface WorkflowWizardProgressSummary {
  readonly sections: ReadonlyArray<WorkflowWizardSectionProgress>;
  readonly currentSectionId: WorkflowWizardSectionId;
  readonly previousSectionId?: WorkflowWizardSectionId;
  readonly nextSectionId?: WorkflowWizardSectionId;
  readonly firstIncompleteSectionId?: WorkflowWizardSectionId;
  readonly readySectionCount: number;
  readonly completedSectionCount: number;
  readonly validationIssueCount: number;
  readonly isWorkflowReady: boolean;
}

interface SectionDefinition {
  readonly id: WorkflowWizardSectionId;
  readonly title: string;
  readonly anchorId: string;
  readonly sectionName: string;
  readonly pathPrefix: string;
  readonly resolveCount: (draft: WorkflowDraft) => number;
}

const wizardSectionDefinitions: ReadonlyArray<SectionDefinition> = Object.freeze([
  Object.freeze({
    id: WorkflowWizardSectionIds.trigger,
    title: "Trigger",
    anchorId: "workflow-wizard-trigger",
    sectionName: "triggers",
    pathPrefix: "draft.triggers",
    resolveCount: (draft: WorkflowDraft) => Array.isArray(draft.triggers) ? draft.triggers.length : 0,
  }),
  Object.freeze({
    id: WorkflowWizardSectionIds.inputs,
    title: "Inputs",
    anchorId: "workflow-wizard-inputs",
    sectionName: "inputs",
    pathPrefix: "draft.inputs",
    resolveCount: (draft: WorkflowDraft) => Array.isArray(draft.inputs) ? draft.inputs.length : 0,
  }),
  Object.freeze({
    id: WorkflowWizardSectionIds.steps,
    title: "Steps",
    anchorId: "workflow-wizard-steps",
    sectionName: "steps",
    pathPrefix: "draft.steps",
    resolveCount: (draft: WorkflowDraft) => Array.isArray(draft.steps) ? draft.steps.length : 0,
  }),
  Object.freeze({
    id: WorkflowWizardSectionIds.outputs,
    title: "Outputs",
    anchorId: "workflow-wizard-outputs",
    sectionName: "outputs",
    pathPrefix: "draft.outputs",
    resolveCount: (draft: WorkflowDraft) => Array.isArray(draft.outputs) ? draft.outputs.length : 0,
  }),
]);

function mapIssueCountBySection(
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): ReadonlyMap<WorkflowWizardSectionId, number> {
  const counts = new Map<WorkflowWizardSectionId, number>();
  for (const issue of draftValidationIssues) {
    for (const definition of wizardSectionDefinitions) {
      const matchesSection = issue.section === definition.sectionName;
      const matchesPath = issue.path?.startsWith(definition.pathPrefix);
      if (!matchesSection && !matchesPath) {
        continue;
      }

      counts.set(definition.id, (counts.get(definition.id) ?? 0) + 1);
    }
  }
  return counts;
}

function toStatusLabel(issueCount: number, isComplete: boolean): WorkflowWizardSectionProgress["statusLabel"] {
  if (issueCount > 0) {
    return "has-issues";
  }
  if (!isComplete) {
    return "needs-input";
  }
  return "ready";
}

export function deriveWorkflowWizardProgress(
  sharedDraft: WorkflowDraft,
  draftValidationIssues: ReadonlyArray<WorkflowValidationIssue>,
): WorkflowWizardProgressSummary {
  const issueCountBySection = mapIssueCountBySection(draftValidationIssues);
  const sections = wizardSectionDefinitions.map((definition) => {
    const itemCount = definition.resolveCount(sharedDraft);
    const issueCount = issueCountBySection.get(definition.id) ?? 0;
    const isComplete = itemCount > 0;
    const isReady = isComplete && issueCount === 0;

    return Object.freeze({
      id: definition.id,
      title: definition.title,
      anchorId: definition.anchorId,
      itemCount,
      issueCount,
      isComplete,
      isReady,
      statusLabel: toStatusLabel(issueCount, isComplete),
    });
  });

  const firstIncomplete = sections.find((section) => !section.isReady);
  const currentSection = firstIncomplete ?? sections[sections.length - 1];
  const currentIndex = sections.findIndex((section) => section.id === currentSection.id);

  const completedSectionCount = sections.filter((section) => section.isComplete).length;
  const readySectionCount = sections.filter((section) => section.isReady).length;

  return Object.freeze({
    sections: Object.freeze(sections),
    currentSectionId: currentSection.id,
    previousSectionId: currentIndex > 0 ? sections[currentIndex - 1]?.id : undefined,
    nextSectionId: currentIndex < sections.length - 1 ? sections[currentIndex + 1]?.id : undefined,
    firstIncompleteSectionId: firstIncomplete?.id,
    completedSectionCount,
    readySectionCount,
    validationIssueCount: draftValidationIssues.length,
    isWorkflowReady: readySectionCount === sections.length,
  });
}
