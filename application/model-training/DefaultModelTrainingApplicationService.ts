import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IModelTrainingJobRepository } from "../ports/interfaces/IModelTrainingJobRepository";
import type { IModelTrainingRuntime } from "../ports/interfaces/IModelTrainingRuntime";
import type { DatasetRepository, DatasetVersionRepository } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import type { ModelTrainingJob } from "../../domain/model-training/ModelTrainingTypes";
import type { ModelTrainingApplicationService } from "./ModelTrainingApplicationService";
import type { ModelTrainingStudioSummary, SubmitModelTrainingJobCommand } from "./contracts";

function defaultCreateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `training_job_${crypto.randomUUID()}`;
  }

  return `training_job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class DefaultModelTrainingApplicationService implements ModelTrainingApplicationService {
  constructor(
    private readonly installedModelCatalog: IInstalledModelCatalog,
    private readonly datasetRepository: DatasetRepository,
    private readonly datasetVersionRepository: DatasetVersionRepository,
    private readonly jobRepository: IModelTrainingJobRepository,
    private readonly runtime: IModelTrainingRuntime,
    private readonly createId: () => string = defaultCreateId,
  ) {}

  public async listJobs(): Promise<ReadonlyArray<ModelTrainingJob>> {
    const jobs = await this.jobRepository.listJobs();
    return Object.freeze([...jobs].sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime()));
  }

  public async getStudioSummary(): Promise<ModelTrainingStudioSummary> {
    return Object.freeze({ jobs: await this.listJobs() });
  }

  public async submitJob(command: SubmitModelTrainingJobCommand): Promise<ModelTrainingJob> {
    const baseModel = await this.installedModelCatalog.getInstalledById(command.baseModelId);
    if (!baseModel) {
      throw new Error(`Base model '${command.baseModelId}' is not installed.`);
    }

    const dataset = await this.datasetRepository.load(command.datasetId);
    if (!dataset) {
      throw new Error(`Dataset '${command.datasetId}' was not found.`);
    }

    const version = await this.datasetVersionRepository.loadVersion(command.datasetId, command.datasetVersionId);
    if (!version) {
      throw new Error(`Dataset version '${command.datasetVersionId}' was not found.`);
    }

    const job = await this.runtime.submitJob({
      id: command.id?.trim() || this.createId(),
      name: command.name,
      baseModelId: baseModel.id,
      baseModelName: baseModel.name,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersionId: version.id,
      datasetVersionNumber: version.versionNumber,
      createdBy: command.createdBy,
      configuration: command.configuration,
    });

    await this.jobRepository.saveJob(job);
    return job;
  }
}
