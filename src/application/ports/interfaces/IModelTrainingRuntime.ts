import type { ModelTrainingConfiguration, ModelTrainingExecutionKind, ModelTrainingJob } from "@domain/model-training/ModelTrainingTypes";
import type { DatasetTaskType } from "@domain/tuning-datasets/interfaces/ITuningDatasetStudio";

export interface SubmitModelTrainingDatasetExample {
  readonly id: string;
  readonly taskType: DatasetTaskType;
  readonly inputText: string;
  readonly targetText: string;
  readonly sourceDocumentId?: string;
}

export interface SubmitModelTrainingJobRequest {
  readonly id: string;
  readonly name: string;
  readonly executionKind: ModelTrainingExecutionKind;
  readonly baseModelId: string;
  readonly baseModelName: string;
  readonly baseModelLocation?: string;
  readonly datasetId: string;
  readonly datasetName: string;
  readonly datasetVersionId: string;
  readonly datasetVersionNumber: number;
  readonly datasetTaskType: DatasetTaskType;
  readonly createdBy: string;
  readonly configuration: ModelTrainingConfiguration;
  readonly examples: ReadonlyArray<SubmitModelTrainingDatasetExample>;
  readonly assetLineage?: {
    readonly datasetVersionAssetId?: string;
    readonly baseModelAssetId?: string;
    readonly sourceVersionIds?: ReadonlyArray<string>;
    readonly outputAssetNamespace?: string;
  };
}

export interface IModelTrainingRuntime {
  submitJob(request: SubmitModelTrainingJobRequest): Promise<ModelTrainingJob>;
  getJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  refreshJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  reconcileJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  listJobs(): Promise<ReadonlyArray<ModelTrainingJob>>;
  cancelJob(jobId: string): Promise<ModelTrainingJob>;
}

