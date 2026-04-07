import type { ModelTrainingJob } from "../../../domain/model-training/ModelTrainingTypes";

export interface IModelTrainingJobRepository {
  listJobs(): Promise<ReadonlyArray<ModelTrainingJob>>;
  getJobById(id: string): Promise<ModelTrainingJob | undefined>;
  saveJob(job: ModelTrainingJob): Promise<void>;
}
