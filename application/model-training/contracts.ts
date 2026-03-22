import type { ModelTrainingConfiguration, ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";

export interface SubmitModelTrainingJobCommand {
  readonly id?: string;
  readonly name: string;
  readonly baseModelId: string;
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly createdBy: string;
  readonly configuration: ModelTrainingConfiguration;
}

export interface ModelTrainingStudioSummary {
  readonly jobs: ReadonlyArray<ModelTrainingJob>;
}
