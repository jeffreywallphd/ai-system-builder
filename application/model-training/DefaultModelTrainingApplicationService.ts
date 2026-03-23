import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IModelTrainingJobRepository } from "../ports/interfaces/IModelTrainingJobRepository";
import type { IModelTrainingRuntime } from "../ports/interfaces/IModelTrainingRuntime";
import type { DatasetRepository, DatasetVersionRepository } from "../../domain/tuning-datasets/interfaces/ITuningDatasetStudio";
import { ChatCompletionExample, QuestionAnsweringExample } from "../../domain/tuning-datasets/TuningDatasetEntities";
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
    const runtimeJobs = await this.runtime.listJobs().catch(() => [] as ReadonlyArray<ModelTrainingJob>);
    for (const job of runtimeJobs) {
      await this.jobRepository.saveJob(job);
    }

    const jobs = await this.jobRepository.listJobs();
    return Object.freeze([...jobs].sort((left, right) => {
      const rightTime = right.submittedAt?.getTime() ?? right.createdAt.getTime();
      const leftTime = left.submittedAt?.getTime() ?? left.createdAt.getTime();
      return rightTime - leftTime;
    }));
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

    const examples = await this.datasetVersionRepository.listExamples({
      datasetId: dataset.id,
      versionId: version.id,
    });
    const eligibleExamples = examples.filter((example) => example.status !== "rejected");
    if (eligibleExamples.length === 0) {
      throw new Error("Training requires at least one non-rejected dataset example.");
    }

    const job = await this.runtime.submitJob({
      id: command.id?.trim() || this.createId(),
      name: command.name,
      executionKind: command.executionKind ?? "local-gradient-training",
      baseModelId: baseModel.id,
      baseModelName: baseModel.name,
      baseModelLocation: baseModel.artifact.location,
      datasetId: dataset.id,
      datasetName: dataset.name,
      datasetVersionId: version.id,
      datasetVersionNumber: version.versionNumber,
      datasetTaskType: dataset.taskType,
      createdBy: command.createdBy,
      configuration: command.configuration,
      examples: eligibleExamples.map((example) => {
        if (example instanceof QuestionAnsweringExample) {
          return Object.freeze({
            id: example.id,
            taskType: example.taskType,
            inputText: `Question: ${example.question}\n\nContext: ${example.context}`,
            targetText: example.answer,
            sourceDocumentId: example.sourceDocumentId,
          });
        }

        const chatExample = example as ChatCompletionExample;
        const promptMessages = chatExample.messages.filter((message) => message.role !== "assistant");
        const assistantMessages = chatExample.messages.filter((message) => message.role === "assistant");
        return Object.freeze({
          id: chatExample.id,
          taskType: chatExample.taskType,
          inputText: promptMessages.map((message) => `${message.role}: ${message.content}`).join("\n"),
          targetText: assistantMessages.map((message) => message.content).join("\n"),
          sourceDocumentId: chatExample.lineage.sourceDocumentId,
        });
      }),
    });

    await this.jobRepository.saveJob(job);
    return job;
  }
}
