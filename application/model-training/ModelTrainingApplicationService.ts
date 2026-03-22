import type { ModelTrainingStudioSummary, SubmitModelTrainingJobCommand } from "./contracts";
import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";

export interface ModelTrainingApplicationService {
  listJobs(): Promise<ReadonlyArray<ModelTrainingJob>>;
  submitJob(command: SubmitModelTrainingJobCommand): Promise<ModelTrainingJob>;
  getStudioSummary(): Promise<ModelTrainingStudioSummary>;
}
