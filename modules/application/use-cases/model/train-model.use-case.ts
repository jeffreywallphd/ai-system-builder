import {
  normalizeModelTrainingRequest,
  normalizeModelTrainingResult,
  type ModelTrainingRequest,
  type ModelTrainingResult,
} from "../../../contracts/model";
import { TaskType, type RuntimeTaskRecord } from "../../../contracts/runtime";
import type { ModelRegistryPort } from "../../ports/model";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { ArtifactStorageBindingPort } from "../../ports/storage";
import type { TaskPowerLifecyclePort } from "../../services/runtime";

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
  private readonly registeredResultsByRequestId = new Map<string, ModelTrainingResult>();
  private readonly requestContextByRequestId = new Map<string, { normalizedRequest: ModelTrainingRequest; baseModelRecordId?: string }>();

  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      modelRegistry: ModelRegistryPort;
      storageBindings: Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings">;
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

    const started = await this.dependencies.runtimeTaskRegistry.startTask({
      taskType: TaskType.MODEL_TRAINING,
      payload: {
        ...normalizedRequest,
        datasets: await Promise.all(normalizedRequest.datasets.map(async (dataset) => {
          if (dataset.path && dataset.path.trim().length > 0) {
            return dataset;
          }
          const bindingsResult = await this.dependencies.storageBindings.readArtifactStorageBindings({ artifactId: dataset.artifactId });
          if (!bindingsResult.ok) {
            throw new Error(`Failed to resolve storage binding for dataset artifact '${dataset.artifactId}': ${bindingsResult.error.message}`);
          }
          const localBinding = bindingsResult.value.bindings.find((binding) =>
            binding.backing.provider === "local-filesystem" || binding.backing.provider === "local",
          );
          if (localBinding) {
            return { ...dataset, path: localBinding.backing.locator };
          }

          const localObjectBinding = bindingsResult.value.bindings.find((binding) =>
            binding.backing.kind === "artifact-object"
            && binding.backing.provider === "local"
            && binding.backing.locator.trim().length > 0,
          );
          if (localObjectBinding) {
            return { ...dataset, path: localObjectBinding.backing.locator };
          }

          throw new Error(`Dataset artifact '${dataset.artifactId}' is missing a local dataset binding (file or artifact-object).`);
        })),
      },
    });

    if (typeof started.requestId !== "string" || started.requestId.trim().length === 0) {
      throw new Error("Model training start response missing requestId.");
    }

    this.requestContextByRequestId.set(started.requestId, { normalizedRequest, baseModelRecordId });
    try {
      await this.dependencies.taskPowerLifecycle.startTask(started.requestId, TaskType.MODEL_TRAINING);
    } catch {
      // Power blocker startup failures must not fail model training.
    }

    return {
      runId: started.requestId,
      status: "queued",
    };
  }

  public async read(requestId: string): Promise<ModelTrainingResult> {
    const cached = this.registeredResultsByRequestId.get(requestId);
    if (cached) {
      return cached;
    }

    const statusRecord = await this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
    if (statusRecord.status === "succeeded") {
      return this.resolveSucceededResult(statusRecord);
    }

    if (statusRecord.status === "failed" || statusRecord.status === "cancelled" || statusRecord.status === "unknown") {
      await this.completePowerLifecycle(requestId, statusRecord.status);
      return normalizeModelTrainingResult({
        runId: requestId,
        status: statusRecord.status === "unknown" ? "failed" : statusRecord.status,
        ...(statusRecord.error ? { error: statusRecord.error } : {}),
      });
    }

    return normalizeModelTrainingResult({
      runId: requestId,
      status: statusRecord.status,
    });
  }

  private async resolveSucceededResult(statusRecord: RuntimeTaskRecord): Promise<ModelTrainingResult> {
    if (!statusRecord.data || typeof statusRecord.data !== "object") {
      throw new Error(`Model training runtime result missing for request '${statusRecord.requestId}'.`);
    }

    const trainingResult = normalizeModelTrainingResult(statusRecord.data as ModelTrainingResult);

    if (trainingResult.status !== "succeeded" || !trainingResult.generatedModelCandidate) {
      await this.completePowerLifecycle(statusRecord.requestId, "unknown");
      return trainingResult;
    }

    const requestContext = this.requestContextByRequestId.get(statusRecord.requestId);
    if (!requestContext) {
      throw new Error(`Model training request context missing for request '${statusRecord.requestId}'.`);
    }

    const { normalizedRequest, baseModelRecordId } = requestContext;
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

    const result = {
      ...trainingResult,
      outputModel: registered.model,
    };
    this.registeredResultsByRequestId.set(statusRecord.requestId, result);
    await this.completePowerLifecycle(statusRecord.requestId, "succeeded");
    return result;
  }

  private async completePowerLifecycle(requestId: string, status: "succeeded" | "failed" | "cancelled" | "unknown"): Promise<void> {
    try {
      await this.dependencies.taskPowerLifecycle.completeTask(requestId, status);
    } catch {
      // Power blocker teardown failures must not fail model training.
    }
  }
}
