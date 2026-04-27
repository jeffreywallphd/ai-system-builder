import type { ModelTrainingPort } from "../../../application/ports/model";
import type { PythonRuntimePort } from "../../../application/ports/runtime";
import type {
  ModelTrainingRequest,
  ModelTrainingResult,
  ModelTrainingStatus,
} from "../../../contracts/model";
import type {
  PythonRuntimeError,
  TrainModelTaskRequest,
  TrainModelTaskResult,
} from "../../../contracts/runtime";

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid train-model result: ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid train-model result: ${field} must be a non-empty string.`);
  }
  return value;
}

function asStatus(value: unknown): ModelTrainingStatus {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled") {
    return value;
  }
  throw new Error("Invalid train-model result: status must be queued|running|succeeded|failed|cancelled.");
}

function mapRuntimeError(error: PythonRuntimeError | undefined): ModelTrainingResult {
  return {
    runId: error?.details && typeof error.details.runId === "string" ? error.details.runId : "runtime-error",
    status: "failed",
    error: {
      code: error?.errorCode ?? error?.code ?? "runtime_task_failed",
      message: error?.message ?? "Python runtime training task failed.",
      details: error?.details,
    },
    warnings: error?.details?.warnings && Array.isArray(error.details.warnings)
      ? error.details.warnings.map((warning) => String(warning))
      : undefined,
  };
}

function mapRuntimeResult(data: unknown): ModelTrainingResult {
  const payload = asObject(data, "data");
  const checkpoints = Array.isArray(payload.checkpoints)
    ? payload.checkpoints.flatMap((checkpoint) => {
        if (!checkpoint || typeof checkpoint !== "object") {
          return [];
        }
        const record = checkpoint as Record<string, unknown>;
        return [{
          path: asString(record.path, "checkpoints[].path"),
          step: typeof record.step === "number" ? record.step : undefined,
          metric: typeof record.metric === "string" ? record.metric : undefined,
          value: typeof record.value === "number" ? record.value : undefined,
        }];
      })
    : undefined;

  const generatedCandidate = payload.generatedModelCandidate && typeof payload.generatedModelCandidate === "object"
    ? payload.generatedModelCandidate as Record<string, unknown>
    : undefined;

  return {
    runId: asString(payload.runId, "runId"),
    status: asStatus(payload.status),
    outputDirectory: typeof payload.outputDirectory === "string" ? payload.outputDirectory : undefined,
    outputModelName: typeof payload.outputModelName === "string" ? payload.outputModelName : undefined,
    checkpoints,
    metrics: payload.metrics && typeof payload.metrics === "object" ? payload.metrics as Record<string, number> : undefined,
    logs: Array.isArray(payload.logs) ? payload.logs.map((entry) => String(entry)) : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((entry) => String(entry)) : undefined,
    generatedModelCandidate: generatedCandidate
      ? {
          displayName: asString(generatedCandidate.displayName, "generatedModelCandidate.displayName"),
          provider: typeof generatedCandidate.provider === "string" ? generatedCandidate.provider as "huggingface" | "unknown" : undefined,
          modelId: typeof generatedCandidate.modelId === "string" ? generatedCandidate.modelId : undefined,
          localPath: typeof generatedCandidate.localPath === "string" ? generatedCandidate.localPath : undefined,
          artifactForm: typeof generatedCandidate.artifactForm === "string" ? generatedCandidate.artifactForm as "adapter" | "merged-model" | "full-model" | "checkpoint" : undefined,
          inferenceMode: typeof generatedCandidate.inferenceMode === "string" ? generatedCandidate.inferenceMode as "text2text" | "causal" | "chat" : undefined,
          taskTags: Array.isArray(generatedCandidate.taskTags) ? generatedCandidate.taskTags.map((entry) => String(entry)) : undefined,
          baseModelId: typeof generatedCandidate.baseModelId === "string" ? generatedCandidate.baseModelId : undefined,
          adapterOfModelId: typeof generatedCandidate.adapterOfModelId === "string" ? generatedCandidate.adapterOfModelId : undefined,
          generatedFromRunId: typeof generatedCandidate.generatedFromRunId === "string" ? generatedCandidate.generatedFromRunId : undefined,
          serializationFormat: typeof generatedCandidate.serializationFormat === "string" ? generatedCandidate.serializationFormat : undefined,
          sizeBytes: typeof generatedCandidate.sizeBytes === "number" ? generatedCandidate.sizeBytes : undefined,
          metadata: generatedCandidate.metadata && typeof generatedCandidate.metadata === "object" ? generatedCandidate.metadata as Record<string, unknown> : undefined,
        }
      : undefined,
    error: payload.error && typeof payload.error === "object"
      ? {
          code: asString((payload.error as Record<string, unknown>).code, "error.code"),
          message: asString((payload.error as Record<string, unknown>).message, "error.message"),
          details: (payload.error as Record<string, unknown>).details && typeof (payload.error as Record<string, unknown>).details === "object"
            ? (payload.error as Record<string, unknown>).details as Record<string, unknown>
            : undefined,
        }
      : undefined,
  };
}

function toRuntimeTaskRequest(request: ModelTrainingRequest): TrainModelTaskRequest {
  return {
    baseModel: request.baseModel,
    datasets: request.datasets.map((dataset) => ({
      artifactId: dataset.artifactId,
      splitRole: dataset.splitRole ?? "train",
      format: dataset.format,
      path: dataset.path,
    })),
    method: request.method,
    commonParameters: request.commonParameters,
    advancedParameters: request.advancedParameters,
    output: {
      outputModelName: request.output.outputModelName,
      outputDirectory: request.output.localOutputDirectory,
    },
    validation: request.validation
      ? {
          enabled: request.validation.enabled,
          expectedLoRA: request.validation.expectedLoRA,
          expectedRecurrentAdditions: request.validation.expectedRecurrentAdditions,
        }
      : undefined,
    runMetadata: request.runtimeMetadata,
  };
}

export function createPythonModelTrainingPort(
  runtimePort: PythonRuntimePort,
  options?: { taskTimeoutMs?: number; ensureRuntimeReady?: () => Promise<void> | void },
): ModelTrainingPort {
  let sequence = 0;
  const nextRequestId = () => {
    sequence += 1;
    const timestamp = new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
    return `train-model-${timestamp}-${String(sequence).padStart(6, "0")}`;
  };

  return {
    async trainModel(request: ModelTrainingRequest): Promise<ModelTrainingResult> {
      if (options?.ensureRuntimeReady) {
        await options.ensureRuntimeReady();
      }

      const taskRequest = toRuntimeTaskRequest(request);
      const taskResult = await runtimePort.executeTask({
        requestId: nextRequestId(),
        taskType: "train-model",
        payload: taskRequest,
        timeoutMs: options?.taskTimeoutMs,
      });

      if (!taskResult.success) {
        return mapRuntimeError(taskResult.error);
      }

      return mapRuntimeResult(taskResult.data as TrainModelTaskResult);
    },
  };
}
