import type { WorkflowStageStatus } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";

export interface LinearWizardStep<StepId extends string = string> {
  readonly id: StepId;
  readonly title: string;
  readonly description: string;
  readonly status: WorkflowStageStatus;
  readonly sequence: number;
  readonly isActive: boolean;
  readonly isAccessible: boolean;
}

export interface LinearWizardDefinition<StepId extends string = string> {
  readonly steps: ReadonlyArray<LinearWizardStep<StepId>>;
  readonly currentStepId: StepId;
  readonly progressPercent: number;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
  readonly previousStepId?: StepId;
  readonly nextStepId?: StepId;
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
}

export function buildLinearWizardDefinition<StepId extends string>(params: {
  readonly steps: ReadonlyArray<{
    readonly id: StepId;
    readonly title: string;
    readonly description: string;
    readonly status: WorkflowStageStatus;
  }>;
  readonly currentStepId: StepId;
  readonly progressPercent: number;
}): LinearWizardDefinition<StepId> {
  const steps = Object.freeze(params.steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    status: step.status,
    sequence: index,
    isActive: step.id === params.currentStepId,
    isAccessible: step.status === "completed" || step.status === "current",
  })));
  const currentIndex = steps.findIndex((step) => step.id === params.currentStepId);
  if (currentIndex === -1) {
    throw new Error(`Unknown wizard step '${params.currentStepId}'.`);
  }

  const previousStepId = currentIndex > 0 ? steps[currentIndex - 1]?.id : undefined;
  const nextStepId = currentIndex < steps.length - 1 ? steps[currentIndex + 1]?.id : undefined;

  return Object.freeze({
    steps,
    currentStepId: params.currentStepId,
    progressPercent: Math.max(0, Math.min(100, params.progressPercent)),
    completedStepCount: steps.filter((step) => step.status === "completed").length,
    totalStepCount: steps.length,
    previousStepId,
    nextStepId,
    canGoBack: typeof previousStepId === "string",
    canGoNext: typeof nextStepId === "string",
  });
}
