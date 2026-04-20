import type { PythonDatasetPreparationPort, PythonRuntimePort } from "../../../application/ports/runtime";
import type {
  PrepareTrainingDatasetRequest,
  PrepareTrainingDatasetResult,
  DatasetPreparationWarning,
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
    const role = parseOutputRole(descriptor.role, `outputs[${index}].role`);
    return {
      name: asString(descriptor.name, `outputs[${index}].name`),
      role,
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

const ALLOWED_OUTPUT_ROLES = new Set<PythonRuntimeOutputDescriptor["role"]>([
  "train",
  "test",
  "metrics",
  "report",
  "artifact",
  undefined,
]);

function parseOutputRole(
  value: unknown,
  field: string,
): PythonRuntimeOutputDescriptor["role"] {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid dataset preparation result: ${field} must be a string when provided.`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  if (!ALLOWED_OUTPUT_ROLES.has(normalized as PythonRuntimeOutputDescriptor["role"])) {
    throw new Error(`Invalid dataset preparation result: ${field} must be a known runtime output role.`);
  }

  return normalized as PythonRuntimeOutputDescriptor["role"];
}

function parseWarnings(value: unknown): DatasetPreparationWarning[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((warning, index) => {
    const normalized = asObject(warning, `warnings[${index}]`);
    if (typeof normalized.code !== "string" || typeof normalized.message !== "string") {
      return [];
    }

    return [{
      code: normalized.code,
      message: normalized.message,
      sourceArtifactId: typeof normalized.sourceArtifactId === "string" ? normalized.sourceArtifactId : undefined,
    }];
  });
}

function mapRuntimeDataToResult(data: unknown): PrepareTrainingDatasetResult {
  const payload = asObject(data, "data");
  const summary = asObject(payload.summary, "summary");

  return {
    outputs: parseOutputDescriptors(payload.outputs),
    summary: {
      sourceDocumentCount: asNumber(summary.sourceDocumentCount, "summary.sourceDocumentCount"),
      normalizedDocumentCount: asNumber(summary.normalizedDocumentCount, "summary.normalizedDocumentCount"),
      skippedDocumentCount: asNumber(summary.skippedDocumentCount, "summary.skippedDocumentCount"),
      chunkCount: asNumber(summary.chunkCount, "summary.chunkCount"),
      generatedExampleCount: asNumber(summary.generatedExampleCount, "summary.generatedExampleCount"),
      trainRowCount: asNumber(summary.trainRowCount, "summary.trainRowCount"),
      testRowCount: asNumber(summary.testRowCount, "summary.testRowCount"),
    },
    warnings: parseWarnings(payload.warnings),
  };
}

export function createPythonDatasetPreparationPort(
  runtimePort: PythonRuntimePort,
): PythonDatasetPreparationPort {
  let sequence = 0;

  const nextRequestId = () => {
    sequence += 1;
    const timestamp = new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
    return `prepare-training-dataset-${timestamp}-${String(sequence).padStart(6, "0")}`;
  };

  return {
    async prepareTrainingDataset(request: PrepareTrainingDatasetRequest): Promise<PrepareTrainingDatasetResult> {
      const taskResult = await runtimePort.executeTask({
        requestId: nextRequestId(),
        taskType: "prepare-training-dataset",
        payload: request,
      });

      if (!taskResult.success) {
        throw new Error(taskResult.error?.message ?? "Python runtime dataset preparation failed.");
      }

      return mapRuntimeDataToResult(taskResult.data);
    },
  };
}
