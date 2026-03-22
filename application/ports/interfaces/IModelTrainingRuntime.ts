import type { ModelTrainingJob, ModelTrainingConfiguration } from "../../../domain/model-training/ModelTrainingTypes";

export interface SubmitModelTrainingJobRequest {
  readonly id: string;
  readonly name: string;
  readonly baseModelId: string;
  readonly baseModelName: string;
  readonly datasetId: string;
  readonly datasetName: string;
  readonly datasetVersionId: string;
  readonly datasetVersionNumber: number;
  readonly createdBy: string;
  readonly configuration: ModelTrainingConfiguration;
}

export interface IModelTrainingRuntime {
  submitJob(request: SubmitModelTrainingJobRequest): Promise<ModelTrainingJob>;
}
