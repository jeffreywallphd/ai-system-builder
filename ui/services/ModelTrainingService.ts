import type { ModelTrainingApplicationService } from "../../application/model-training/ModelTrainingApplicationService";
import type {
  GetModelTrainingStudioSummaryQuery,
  PromoteModelTrainingJobCommand,
  SubmitModelTrainingJobCommand,
} from "../../application/model-training/contracts";

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

  public getStudioSummary(query?: GetModelTrainingStudioSummaryQuery) {
    return this.applicationService.getStudioSummary(query);
  }

  public promoteJob(command: PromoteModelTrainingJobCommand) {
    return this.applicationService.promoteJob(command);
  }

  public submitJob(command: SubmitModelTrainingJobCommand) {
    return this.applicationService.submitJob(command);
  }
}
