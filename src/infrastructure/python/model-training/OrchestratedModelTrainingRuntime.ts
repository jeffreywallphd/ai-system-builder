import type { IModelTrainingRuntime, SubmitModelTrainingJobRequest } from "../../../application/ports/interfaces/IModelTrainingRuntime";
import {
  RuntimeDependencyIds,
  RuntimeDependencyUnavailableError,
  type IRuntimeDependencyOrchestrator,
} from "../../../application/runtime/RuntimeDependencyOrchestrator";
import type { ModelTrainingJob } from "../../../domain/model-training/ModelTrainingTypes";
import { createRuntimeDependencyDetail } from "../../runtime/RuntimeDependencyDiagnostics";

export class OrchestratedModelTrainingRuntime implements IModelTrainingRuntime {
  constructor(
    private readonly delegate: IModelTrainingRuntime,
    private readonly orchestrator: IRuntimeDependencyOrchestrator,
  ) {}

  public async submitJob(request: SubmitModelTrainingJobRequest): Promise<ModelTrainingJob> {
    await this.ensureRuntime("submit-model-training-job");
    return this.delegate.submitJob(request);
  }

  public async getJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    await this.ensureRuntime("get-model-training-job");
    return this.delegate.getJob(jobId);
  }

  public async refreshJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    await this.ensureRuntime("refresh-model-training-job");
    return this.delegate.refreshJob(jobId);
  }

  public async reconcileJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    await this.ensureRuntime("reconcile-model-training-job");
    return this.delegate.reconcileJob(jobId);
  }

  public async listJobs(): Promise<ReadonlyArray<ModelTrainingJob>> {
    await this.ensureRuntime("list-model-training-jobs");
    return this.delegate.listJobs();
  }

  public async cancelJob(jobId: string): Promise<ModelTrainingJob> {
    await this.ensureRuntime("cancel-model-training-job");
    return this.delegate.cancelJob(jobId);
  }

  private async ensureRuntime(operation: string): Promise<void> {
    const resolution = await this.orchestrator.ensureAvailable(RuntimeDependencyIds.modelTrainingRuntime);
    if (!resolution.available) {
      throw new RuntimeDependencyUnavailableError(
        resolution,
        createRuntimeDependencyDetail(resolution, `Cannot ${operation} because the model training runtime is unavailable.`),
      );
    }
  }
}
