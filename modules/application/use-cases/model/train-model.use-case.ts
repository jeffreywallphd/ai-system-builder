import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, parse } from "node:path";

import {
  normalizeModelTrainingRequest,
  normalizeModelTrainingResult,
  type ModelTrainingRequest,
  type ModelTrainingResult,
} from "../../../contracts/model";
import { TaskType, type RuntimeTaskRecord } from "../../../contracts/runtime";
import { createRetrieveArtifactRequest } from "../../../contracts/storage";
import type { ModelRegistryPort } from "../../ports/model";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { ArtifactObjectStoragePort, ArtifactStorageBindingPort } from "../../ports/storage";
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

function extensionForMediaType(mediaType: string | undefined): string {
  if (mediaType === "application/x-parquet" || mediaType === "application/vnd.apache.parquet") {
    return ".parquet";
  }

  if (mediaType === "application/x-ndjson" || mediaType === "application/jsonl") {
    return ".jsonl";
  }

  if (mediaType === "application/json" || mediaType === "text/json") {
    return ".json";
  }

  if (mediaType === "text/csv" || mediaType === "application/csv") {
    return ".csv";
  }

  return ".parquet";
}

function sanitizeRuntimeDatasetFileSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "dataset";
}

function buildRuntimeDatasetPath(
  runtimeDatasetDir: string,
  artifactId: string,
  mediaType: string | undefined,
  datasetIndex: number,
): string {
  const sourceName = basename(artifactId);
  const stem = sanitizeRuntimeDatasetFileSegment(parse(sourceName).name || sourceName);
  const extension = parse(sourceName).ext || extensionForMediaType(mediaType);
  const prefix = `${String(datasetIndex + 1).padStart(4, "0")}-${stem}`;
  return join(runtimeDatasetDir, `${prefix}${extension}`);
}

export class TrainModelUseCase {
  private readonly registeredResultsByRequestId = new Map<string, ModelTrainingResult>();
  private readonly requestContextByRequestId = new Map<string, { normalizedRequest: ModelTrainingRequest; baseModelRecordId?: string }>();
  private readonly runtimeDatasetDirsByRequestId = new Map<string, string>();

  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      modelRegistry: ModelRegistryPort;
      storageBindings: Pick<ArtifactStorageBindingPort, "readArtifactStorageBindings">;
      storage: Pick<ArtifactObjectStoragePort, "retrieveArtifact">;
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

    let runtimeDatasetDir: string | undefined;
    try {
      const resolvedDatasets = [];
      for (const [datasetIndex, dataset] of normalizedRequest.datasets.entries()) {
        const resolved = await this.resolveDatasetForRuntime(dataset, datasetIndex, () => runtimeDatasetDir, (value) => { runtimeDatasetDir = value; });
        resolvedDatasets.push(resolved);
      }

      const started = await this.dependencies.runtimeTaskRegistry.startTask({
        taskType: TaskType.MODEL_TRAINING,
        payload: {
          ...normalizedRequest,
          datasets: resolvedDatasets,
        },
      });

      if (typeof started.requestId !== "string" || started.requestId.trim().length === 0) {
        throw new Error("Model training start response missing requestId.");
      }

      this.requestContextByRequestId.set(started.requestId, { normalizedRequest, baseModelRecordId });
      if (runtimeDatasetDir) {
        this.runtimeDatasetDirsByRequestId.set(started.requestId, runtimeDatasetDir);
      }
      try {
        await this.dependencies.taskPowerLifecycle.startTask(started.requestId, TaskType.MODEL_TRAINING);
      } catch {
        // Power blocker startup failures must not fail model training.
      }

      return {
        runId: started.requestId,
        status: "queued",
      };
    } catch (error) {
      if (runtimeDatasetDir) {
        await rm(runtimeDatasetDir, { recursive: true, force: true });
      }
      throw error;
    }
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
      await this.cleanupRuntimeDatasetDir(requestId);
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
      await this.cleanupRuntimeDatasetDir(statusRecord.requestId);
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
    await this.cleanupRuntimeDatasetDir(statusRecord.requestId);
    return result;
  }

  private async resolveDatasetForRuntime(
    dataset: ModelTrainingRequest["datasets"][number],
    datasetIndex: number,
    getRuntimeDatasetDir: () => string | undefined,
    setRuntimeDatasetDir: (value: string) => void,
  ): Promise<ModelTrainingRequest["datasets"][number]> {
    if (dataset.path && dataset.path.trim().length > 0) {
      return dataset;
    }

    const bindingsResult = await this.dependencies.storageBindings.readArtifactStorageBindings({ artifactId: dataset.artifactId });
    if (!bindingsResult.ok) {
      throw new Error(`Failed to resolve storage binding for dataset artifact '${dataset.artifactId}': ${bindingsResult.error.message}`);
    }

    const localFilesystemBinding = bindingsResult.value.bindings.find((binding) =>
      binding.backing.provider === "local-filesystem"
      && binding.backing.locator.trim().length > 0,
    );
    if (localFilesystemBinding) {
      return { ...dataset, path: localFilesystemBinding.backing.locator };
    }

    const localObjectBinding = bindingsResult.value.bindings.find((binding) =>
      binding.backing.kind === "artifact-object"
      && binding.backing.provider === "local"
      && binding.backing.locator.trim().length > 0,
    );
    const storageKey = localObjectBinding?.backing.locator ?? dataset.artifactId;
    const retrieved = await this.dependencies.storage.retrieveArtifact(createRetrieveArtifactRequest(storageKey));
    if (!retrieved.ok) {
      throw new Error(`Failed to retrieve local dataset artifact '${dataset.artifactId}' from artifact-object storage key '${storageKey}': ${retrieved.error.message}`);
    }

    let runtimeDatasetDir = getRuntimeDatasetDir();
    if (!runtimeDatasetDir) {
      runtimeDatasetDir = await mkdtemp(join(tmpdir(), "ai-system-builder-training-datasets-"));
      setRuntimeDatasetDir(runtimeDatasetDir);
    }
    const localPath = buildRuntimeDatasetPath(runtimeDatasetDir, dataset.artifactId, retrieved.value.descriptor.mediaType, datasetIndex);
    await writeFile(localPath, Buffer.from(retrieved.value.content as Uint8Array));
    return {
      ...dataset,
      path: localPath,
      format: dataset.format ?? parse(localPath).ext.replace(/^\./, ""),
    };
  }

  private async completePowerLifecycle(requestId: string, status: "succeeded" | "failed" | "cancelled" | "unknown"): Promise<void> {
    try {
      await this.dependencies.taskPowerLifecycle.completeTask(requestId, status);
    } catch {
      // Power blocker teardown failures must not fail model training.
    }
  }

  private async cleanupRuntimeDatasetDir(requestId: string): Promise<void> {
    const runtimeDatasetDir = this.runtimeDatasetDirsByRequestId.get(requestId);
    if (!runtimeDatasetDir) {
      return;
    }

    this.runtimeDatasetDirsByRequestId.delete(requestId);
    await rm(runtimeDatasetDir, { recursive: true, force: true });
  }
}
