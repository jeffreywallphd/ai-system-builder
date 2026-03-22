import type { IModelTrainingRuntime, SubmitModelTrainingJobRequest } from "../../../application/ports/interfaces/IModelTrainingRuntime";
import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import type { ModelTrainingJob } from "../../../domain/model-training/ModelTrainingTypes";

export class PythonRuntimeModelTrainingGateway implements IModelTrainingRuntime {
  constructor(private readonly client: IPythonRuntimeClient) {}

  public async submitJob(request: SubmitModelTrainingJobRequest): Promise<ModelTrainingJob> {
    const response = await this.client.submitFineTuningJob({
      job_id: request.id,
      job_name: request.name,
      backend: "python-runtime-manifest",
      base_model_id: request.baseModelId,
      base_model_name: request.baseModelName,
      dataset_id: request.datasetId,
      dataset_name: request.datasetName,
      dataset_version_id: request.datasetVersionId,
      dataset_version_number: request.datasetVersionNumber,
      created_by: request.createdBy,
      configuration: {
        epochs: request.configuration.epochs,
        learning_rate: request.configuration.learningRate,
        batch_size: request.configuration.batchSize,
        notes: request.configuration.notes,
      },
    });

    return Object.freeze({
      id: response.job_id,
      name: response.job_name,
      backend: response.backend,
      baseModelId: response.base_model_id,
      datasetId: response.dataset_id,
      datasetVersionId: response.dataset_version_id,
      createdBy: response.created_by,
      createdAt: new Date(response.created_at),
      updatedAt: new Date(response.updated_at),
      submittedAt: new Date(response.submitted_at),
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
    });
  }
}
