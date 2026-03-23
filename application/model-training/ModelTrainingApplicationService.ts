import type { ModelTrainingStudioSummary, SubmitModelTrainingJobCommand } from "./contracts";
import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";

export interface ModelTrainingApplicationService {
  listJobs(): Promise<ReadonlyArray<ModelTrainingJob>>;
  submitJob(command: SubmitModelTrainingJobCommand): Promise<ModelTrainingJob>;
  getJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  refreshJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  reconcileJob(jobId: string): Promise<ModelTrainingJob | undefined>;
  cancelJob(jobId: string): Promise<ModelTrainingJob>;
  getStudioSummary(): Promise<ModelTrainingStudioSummary>;
}
