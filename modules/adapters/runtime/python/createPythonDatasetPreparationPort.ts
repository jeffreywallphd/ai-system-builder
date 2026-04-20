import type { PythonDatasetPreparationPort, PythonRuntimePort } from "../../../application/ports/runtime";
import type {
  PrepareTemplatedDatasetRequest,
  PrepareTemplatedDatasetResult,
  PythonRuntimeOutputDescriptor,
} from "../../../contracts/runtime";

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid dataset preparation result: ${field} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid dataset preparation result: ${field} must be a number.`);
  }

  return value;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid dataset preparation result: ${field} must be a non-empty string.`);
  }

  return value;
}

function parseOutputDescriptors(value: unknown): PythonRuntimeOutputDescriptor[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid dataset preparation result: outputs must be an array.");
  }

  return value.map((entry, index) => {
    const descriptor = asObject(entry, `outputs[${index}]`);
    return {
      name: asString(descriptor.name, `outputs[${index}].name`),
      role: descriptor.role as PythonRuntimeOutputDescriptor["role"],
      tempPath: asString(descriptor.tempPath, `outputs[${index}].tempPath`),
      mediaType: asString(descriptor.mediaType, `outputs[${index}].mediaType`),
      sizeBytes: typeof descriptor.sizeBytes === "number" ? descriptor.sizeBytes : undefined,
      metadata:
        descriptor.metadata && typeof descriptor.metadata === "object" && !Array.isArray(descriptor.metadata)
          ? (descriptor.metadata as Record<string, unknown>)
          : undefined,
    };
  });
}

function mapRuntimeDataToResult(data: unknown): PrepareTemplatedDatasetResult {
  const payload = asObject(data, "data");

  return {
    outputs: parseOutputDescriptors(payload.outputs),
    trainRowCount: asNumber(payload.trainRowCount, "trainRowCount"),
    testRowCount: asNumber(payload.testRowCount, "testRowCount"),
    warnings: Array.isArray(payload.warnings)
      ? payload.warnings.filter((warning): warning is string => typeof warning === "string")
      : undefined,
  };
}

export function createPythonDatasetPreparationPort(
  runtimePort: PythonRuntimePort,
): PythonDatasetPreparationPort {
  return {
    async prepareTemplatedDataset(request: PrepareTemplatedDatasetRequest): Promise<PrepareTemplatedDatasetResult> {
      const taskResult = await runtimePort.executeTask({
        requestId: `prepare-templated-dataset-${Date.now()}`,
        taskType: "prepare-templated-dataset",
        payload: request,
      });

      if (!taskResult.success) {
        throw new Error(taskResult.error?.message ?? "Python runtime dataset preparation failed.");
      }

      return mapRuntimeDataToResult(taskResult.data);
    },
  };
}
