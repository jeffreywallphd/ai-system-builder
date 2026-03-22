import type { ModelTrainingApplicationService } from "../../application/model-training/ModelTrainingApplicationService";
import type { SubmitModelTrainingJobCommand } from "../../application/model-training/contracts";

export class ModelTrainingService {
  constructor(private readonly applicationService: ModelTrainingApplicationService) {}

  public listJobs() {
    return this.applicationService.listJobs();
  }

  public submitJob(command: SubmitModelTrainingJobCommand) {
    return this.applicationService.submitJob(command);
  }
}
