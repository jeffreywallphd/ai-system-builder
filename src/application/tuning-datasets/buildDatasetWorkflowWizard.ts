import { DATASET_WORKFLOW_STAGES, type DatasetWorkflowStage, type DatasetWorkflowState, type WorkflowStageStatus } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { buildLinearWizardDefinition, type LinearWizardDefinition } from "../wizards/contracts";

const DATASET_WORKFLOW_STEP_COPY = Object.freeze<Record<DatasetWorkflowStage, { readonly title: string; readonly description: string }>>({
  dataset_definition: {
    title: "Define dataset",
    description: "Choose the task shape, scope, and initial version metadata.",
  },
  source_ingestion: {
    title: "Ingest sources",
    description: "Bring grounded source material into the working version.",
  },
  example_generation: {
    title: "Generate examples",
    description: "Create draft supervised examples from the imported sources.",
  },
  review_editing: {
    title: "Review & edit",
    description: "Curate examples and resolve quality issues before validation.",
  },
  validation: {
    title: "Validate",
    description: "Run governed validation checks and inspect readiness signals.",
  },
  split_assignment: {
    title: "Assign splits",
    description: "Prepare train, validation, and test assignments for release.",
  },
  release: {
    title: "Release",
    description: "Promote the version once the inner release policy is satisfied.",
  },
  export: {
    title: "Export",
    description: "Download released artifacts after releasing the version.",
  },
});

function resolveStageStatus(workflow: DatasetWorkflowState | undefined, stage: DatasetWorkflowStage, fallbackCurrentStage: DatasetWorkflowStage): WorkflowStageStatus {
  const explicitState = workflow?.stageStates.find((state) => state.stage === stage)?.status;
  if (explicitState) {
    return explicitState;
  }

  if (stage === fallbackCurrentStage) {
    return "current";
  }

  const currentIndex = DATASET_WORKFLOW_STAGES.indexOf(fallbackCurrentStage);
  const stageIndex = DATASET_WORKFLOW_STAGES.indexOf(stage);
  return stageIndex < currentIndex ? "completed" : "pending";
}

export function buildDatasetWorkflowWizard(params: {
  readonly workflow?: DatasetWorkflowState;
  readonly currentStage?: DatasetWorkflowStage;
}): LinearWizardDefinition<DatasetWorkflowStage> {
  const currentStage = params.currentStage ?? params.workflow?.currentStage ?? "dataset_definition";
  return buildLinearWizardDefinition({
    currentStepId: currentStage,
    progressPercent: params.workflow?.progressPercent ?? 0,
    steps: DATASET_WORKFLOW_STAGES.map((stage) => ({
      id: stage,
      title: DATASET_WORKFLOW_STEP_COPY[stage].title,
      description: DATASET_WORKFLOW_STEP_COPY[stage].description,
      status: resolveStageStatus(params.workflow, stage, currentStage),
    })),
  });
}

