import {
  normalizeModelTrainingRequest,
  normalizeModelTrainingResult,
  type ModelTrainingRequest,
  type ModelTrainingResult,
} from "../../../contracts/model";
import { TaskType } from "../../../contracts/runtime";
import type { ModelRegistryPort, ModelTrainingPort } from "../../ports/model";
import type { TaskPowerLifecyclePort } from "../../services/runtime";
import { randomUUID } from "node:crypto";

function ensureBaseModelSelection(request: ModelTrainingRequest): void {
  if (!request.baseModel.modelRecordId && !request.baseModel.modelId && !request.baseModel.localPath) {
    throw new Error("Model training requires a base model selection.");
  }
}

function ensureDatasetSelections(request: ModelTrainingRequest): void {
  if (request.datasets.length === 0) {
    throw new Error("Model training requires at least one dataset artifact.");
  }

  request.datasets.forEach((dataset, index) => {
    if (!dataset.artifactId || dataset.artifactId.trim().length === 0) {
      throw new Error(`Model training dataset at index ${index} is missing artifactId.`);
    }
  });
}

export class TrainModelUseCase {
  public constructor(
    private readonly dependencies: {
      modelTraining: ModelTrainingPort;
      modelRegistry: ModelRegistryPort;
      taskPowerLifecycle: TaskPowerLifecyclePort;
    },
  ) {}

  public async execute(request: ModelTrainingRequest): Promise<ModelTrainingResult> {
    const normalizedRequest = normalizeModelTrainingRequest(request);
    ensureBaseModelSelection(normalizedRequest);
    ensureDatasetSelections(normalizedRequest);

    let baseModelRecordId: string | undefined = normalizedRequest.baseModel.modelRecordId;

    if (normalizedRequest.baseModel.modelRecordId) {
      const baseModelRecord = await this.dependencies.modelRegistry.getModelRecord(normalizedRequest.baseModel.modelRecordId);
      if (!baseModelRecord) {
        throw new Error(`Base model record '${normalizedRequest.baseModel.modelRecordId}' was not found.`);
      }

      baseModelRecordId = baseModelRecord.modelRecordId;
      normalizedRequest.baseModel = {
        ...normalizedRequest.baseModel,
        modelRecordId: baseModelRecord.modelRecordId,
        provider: normalizedRequest.baseModel.provider ?? baseModelRecord.provider,
        modelId: normalizedRequest.baseModel.modelId ?? baseModelRecord.modelId,
        localPath: normalizedRequest.baseModel.localPath ?? baseModelRecord.localPath,
        inferenceMode: normalizedRequest.baseModel.inferenceMode ?? baseModelRecord.inferenceMode,
      };
    }

    const tentativeRunId = randomUUID();
    try {
      await this.dependencies.taskPowerLifecycle.startTask(tentativeRunId, TaskType.MODEL_TRAINING);
    } catch {
      // Power blocker startup failures must not fail model training.
    }
    const blockerRequestId = tentativeRunId;
    let terminalStatus: ModelTrainingResult["status"] | undefined;
    let trainingResult: ModelTrainingResult;
    try {
      trainingResult = normalizeModelTrainingResult(await this.dependencies.modelTraining.trainModel(normalizedRequest));
      terminalStatus = trainingResult.status;
    } finally {
      if (terminalStatus === "succeeded" || terminalStatus === "failed" || terminalStatus === "cancelled") {
        try {
          await this.dependencies.taskPowerLifecycle.completeTask(blockerRequestId, terminalStatus);
        } catch {
          // Power blocker teardown failures must not fail model training.
        }
      } else {
        try {
          await this.dependencies.taskPowerLifecycle.completeTask(blockerRequestId, "unknown");
        } catch {
          // Power blocker teardown failures must not fail model training.
        }
      }
    }

    if (trainingResult.status !== "succeeded" || !trainingResult.generatedModelCandidate) {
      return trainingResult;
    }

    const generated = trainingResult.generatedModelCandidate;
    const registration = normalizedRequest.output.registration;
    const trainingValidation = generated.metadata && typeof generated.metadata["validation"] === "object"
      ? generated.metadata["validation"] as Record<string, unknown>
      : undefined;
    const registered = await this.dependencies.modelRegistry.registerGeneratedModel({
      displayName: registration?.displayName ?? generated.displayName,
      provider: generated.provider,
      modelId: generated.modelId,
      localPath: generated.localPath,
      artifactForm: generated.artifactForm ?? registration?.artifactForm ?? (normalizedRequest.method === "lora" ? "adapter" : "full-model"),
      inferenceMode: generated.inferenceMode ?? registration?.inferenceMode ?? normalizedRequest.baseModel.inferenceMode,
      taskTags: generated.taskTags ?? registration?.taskTags,
      baseModelId: generated.baseModelId ?? registration?.baseModelId ?? normalizedRequest.baseModel.modelId,
      adapterOfModelId: generated.adapterOfModelId ?? registration?.adapterOfModelId ?? normalizedRequest.baseModel.modelId,
      generatedFromRunId: generated.generatedFromRunId ?? trainingResult.runId,
      serializationFormat: generated.serializationFormat,
      sizeBytes: generated.sizeBytes,
      metadata: {
        baseModelRecordId,
        ...registration?.metadata,
        ...generated.metadata,
      },
      validationStatus: typeof trainingValidation?.["status"] === "string"
        ? trainingValidation["status"] as "unknown" | "valid" | "invalid" | "warning"
        : undefined,
      validationReportPath:
        typeof trainingResult.validationReportPath === "string"
          ? trainingResult.validationReportPath
          : (typeof trainingValidation?.["validationReportPath"] === "string" ? trainingValidation["validationReportPath"] : undefined),
    });

    return {
      ...trainingResult,
      outputModel: registered.model,
    };
  }

}
