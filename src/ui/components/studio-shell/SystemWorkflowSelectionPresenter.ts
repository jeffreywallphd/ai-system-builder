import type {
  StudioImageSystemDefinitionSummaryReadModel,
  StudioImageWorkflowDefinitionSummaryReadModel,
} from "@infrastructure/api/studio-shell/StudioShellBackendApi";

export interface SupportedEditTypeOptionViewModel {
  readonly workflowId: string;
  readonly title: string;
  readonly summary: string;
  readonly operationKind: string;
  readonly selected: boolean;
  readonly recommended: boolean;
}

export interface SavedImageSystemOptionViewModel {
  readonly systemId: string;
  readonly title: string;
  readonly readinessState: string;
  readonly readinessSummary: string;
  readonly workflowId: string;
  readonly editTypeTitle?: string;
  readonly selected: boolean;
}

export function presentSupportedEditTypeOptions(input: {
  readonly workflows: ReadonlyArray<StudioImageWorkflowDefinitionSummaryReadModel>;
  readonly selectedWorkflowId?: string;
}): ReadonlyArray<SupportedEditTypeOptionViewModel> {
  const selectedWorkflowId = input.selectedWorkflowId?.trim();
  const fallbackSelectedWorkflowId = selectedWorkflowId && input.workflows.some((entry) => entry.workflowId === selectedWorkflowId)
    ? selectedWorkflowId
    : input.workflows[0]?.workflowId;
  const recommendedWorkflowId = input.workflows[0]?.workflowId;

  return Object.freeze(input.workflows.map((workflow) => Object.freeze({
    workflowId: workflow.workflowId,
    title: workflow.title,
    summary: workflow.summary,
    operationKind: workflow.operationKind,
    selected: workflow.workflowId === fallbackSelectedWorkflowId,
    recommended: workflow.workflowId === recommendedWorkflowId,
  })));
}

export function presentSavedImageSystemOptions(input: {
  readonly systems: ReadonlyArray<StudioImageSystemDefinitionSummaryReadModel>;
  readonly workflows: ReadonlyArray<StudioImageWorkflowDefinitionSummaryReadModel>;
  readonly selectedSystemId?: string;
}): ReadonlyArray<SavedImageSystemOptionViewModel> {
  const workflowTitleById = new Map(input.workflows.map((workflow) => [workflow.workflowId, workflow.title] as const));
  const selectedSystemId = input.selectedSystemId?.trim();

  return Object.freeze(input.systems.map((system) => Object.freeze({
    systemId: system.systemId,
    title: system.title,
    readinessState: system.readinessState,
    readinessSummary: system.readinessSummary,
    workflowId: system.workflowId,
    editTypeTitle: workflowTitleById.get(system.workflowId),
    selected: system.systemId === selectedSystemId,
  })));
}
