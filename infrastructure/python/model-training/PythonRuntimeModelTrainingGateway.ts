import type { IModelTrainingRuntime, SubmitModelTrainingJobRequest } from "../../../application/ports/interfaces/IModelTrainingRuntime";
import type { IPythonRuntimeClient, IPythonRuntimeFineTuningJobResponse } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type { ModelTrainingJob } from "../../../domain/model-training/ModelTrainingTypes";

export class PythonRuntimeModelTrainingGateway implements IModelTrainingRuntime {
  constructor(private readonly client: IPythonRuntimeClient) {}

  public async submitJob(request: SubmitModelTrainingJobRequest): Promise<ModelTrainingJob> {
    const response = await this.client.submitFineTuningJob({
      job_id: request.id,
      job_name: request.name,
      execution_kind: request.executionKind,
      backend: request.executionKind === "preparation-only" ? "python-runtime-manifest" : "python-runtime-local",
      base_model_id: request.baseModelId,
      base_model_name: request.baseModelName,
      base_model_location: request.baseModelLocation,
      dataset_id: request.datasetId,
      dataset_name: request.datasetName,
      dataset_version_id: request.datasetVersionId,
      dataset_version_number: request.datasetVersionNumber,
      dataset_task_type: request.datasetTaskType,
      created_by: request.createdBy,
      examples: request.examples.map((example) => ({
        id: example.id,
        task_type: example.taskType,
        input_text: example.inputText,
        target_text: example.targetText,
        source_document_id: example.sourceDocumentId,
      })),
      configuration: {
        epochs: request.configuration.epochs,
        learning_rate: request.configuration.learningRate,
        batch_size: request.configuration.batchSize,
        notes: request.configuration.notes,
      },
    });

    return toDomainJob(response);
  }

  public async getJob(jobId: string): Promise<ModelTrainingJob | undefined> {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      return undefined;
    }
    return toDomainJob(await this.client.getFineTuningJob(normalizedJobId));
  }

  public async listJobs(): Promise<ReadonlyArray<ModelTrainingJob>> {
    const response = await this.client.listFineTuningJobs();
    return Object.freeze(response.map((job) => toDomainJob(job)));
  }

  public async cancelJob(jobId: string): Promise<ModelTrainingJob> {
    return toDomainJob(await this.client.cancelFineTuningJob(jobId));
  }
}

function toDomainJob(response: IPythonRuntimeFineTuningJobResponse): ModelTrainingJob {
  return Object.freeze({
    id: response.job_id,
    name: response.job_name,
    backend: response.backend,
    executionKind: response.execution_kind,
    baseModelId: response.base_model_id,
    datasetId: response.dataset_id,
    datasetVersionId: response.dataset_version_id,
    createdBy: response.created_by,
    createdAt: new Date(response.created_at),
    updatedAt: new Date(response.updated_at),
    submittedAt: response.submitted_at ? new Date(response.submitted_at) : undefined,
    startedAt: response.started_at ? new Date(response.started_at) : undefined,
    completedAt: response.completed_at ? new Date(response.completed_at) : undefined,
    status: response.status,
    configuration: {
      epochs: response.configuration.epochs,
      learningRate: response.configuration.learning_rate,
      batchSize: response.configuration.batch_size,
      notes: response.configuration.notes,
    },
    diagnostics: Object.freeze(response.diagnostics.map((diagnostic) => Object.freeze({
      code: diagnostic.code,
      level: diagnostic.level,
      message: diagnostic.message,
      detail: diagnostic.detail,
    }))),
    artifacts: Object.freeze(response.artifacts.map((artifact) => Object.freeze({
      id: artifact.id,
      kind: artifact.kind,
      label: artifact.label,
      location: artifact.location,
      contentType: artifact.content_type,
      createdAt: new Date(artifact.created_at),
      metadata: artifact.metadata,
    }))),
    checkpoints: Object.freeze(response.checkpoints.map((checkpoint) => Object.freeze({
      id: checkpoint.id,
      label: checkpoint.label,
      epoch: checkpoint.epoch,
      metricName: checkpoint.metric_name,
      metricValue: checkpoint.metric_value,
      createdAt: new Date(checkpoint.created_at),
      artifactId: checkpoint.artifact_id,
    }))),
    outputModelName: response.output_model_name,
    summary: response.summary,
    progress: response.progress
      ? Object.freeze({
          percent: response.progress.percent,
          currentEpoch: response.progress.current_epoch,
          totalEpochs: response.progress.total_epochs,
          currentStep: response.progress.current_step,
          totalSteps: response.progress.total_steps,
          latestMetricName: response.progress.latest_metric_name,
          latestMetricValue: response.progress.latest_metric_value,
          statusDetail: response.progress.status_detail,
        })
      : undefined,
    provenance: Object.freeze({
      executionKind: response.provenance.execution_kind,
      backend: response.provenance.backend,
      truthfulness: response.provenance.truthfulness,
      runtime: response.provenance.runtime,
      supportsGradientTraining: response.provenance.supports_gradient_training,
      isPreparationOnly: response.provenance.is_preparation_only,
      provider: response.provenance.provider,
      modelIdentity: response.provenance.model_identity,
      detail: response.provenance.detail,
    }),
  });
}
