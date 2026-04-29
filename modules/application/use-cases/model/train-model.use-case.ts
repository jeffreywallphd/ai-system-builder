import {
  normalizeModelTrainingRequest,
  normalizeModelTrainingResult,
  type ModelTrainingRequest,
  type ModelTrainingResult,
} from "../../../contracts/model";
import type { ModelRegistryPort, ModelTrainingPort } from "../../ports/model";
import type { PowerSuspensionBlockerPort } from "../../ports/desktop";

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
      powerSuspension: PowerSuspensionBlockerPort;
    },
  ) {}

  private readonly blockerIdsByRunId = new Map<string, string>();

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

    const trainingResult = normalizeModelTrainingResult(await this.dependencies.modelTraining.trainModel(normalizedRequest));
    await this.startBlocker(trainingResult.runId);
    if (trainingResult.status === "succeeded" || trainingResult.status === "failed" || trainingResult.status === "cancelled") {
      await this.stopBlocker(trainingResult.runId);
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

  private async startBlocker(runId: string): Promise<void> {
    if (!runId || this.blockerIdsByRunId.has(runId)) {
      return;
    }
    try {
      const blocker = await this.dependencies.powerSuspension.startBlocker("model-training", {
        requestId: runId,
        taskType: "model-training",
      });
      this.blockerIdsByRunId.set(runId, blocker.blockerId);
    } catch {
      // Blocker startup failures must not fail training.
    }
  }

  private async stopBlocker(runId: string): Promise<void> {
    const blockerId = this.blockerIdsByRunId.get(runId);
    if (!blockerId) {
      return;
    }
    this.blockerIdsByRunId.delete(runId);
    try {
      await this.dependencies.powerSuspension.stopBlocker(blockerId);
    } catch {
      // Blocker teardown failures must not fail training.
    }
  }
}
