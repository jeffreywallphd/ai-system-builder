import type { ModelTrainingApplicationService } from "../../application/model-training/ModelTrainingApplicationService";
import type { SubmitModelTrainingJobCommand } from "../../application/model-training/contracts";

export class ModelTrainingService {
  constructor(private readonly applicationService: ModelTrainingApplicationService) {}

  public listJobs() {
    return this.applicationService.listJobs();
  }

  public getJob(jobId: string) {
    return this.applicationService.getJob(jobId);
  }

  public refreshJob(jobId: string) {
    return this.applicationService.refreshJob(jobId);
  }

  public reconcileJob(jobId: string) {
    return this.applicationService.reconcileJob(jobId);
  }

  public cancelJob(jobId: string) {
    return this.applicationService.cancelJob(jobId);
  }

  public submitJob(command: SubmitModelTrainingJobCommand) {
    return this.applicationService.submitJob(command);
  }
}
