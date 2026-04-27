import type { ModelValidationPort } from "../../../application/ports/model";
import type { PythonRuntimePort } from "../../../application/ports/runtime";
import type { ValidateModelRequest, ValidateModelResult } from "../../../contracts/model";

export function createPythonModelValidationPort(
  runtimePort: PythonRuntimePort,
  options?: { taskTimeoutMs?: number; ensureRuntimeReady?: () => Promise<void> | void },
): ModelValidationPort {
  let sequence = 0;
  const nextRequestId = () => {
    sequence += 1;
    const timestamp = new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
    return `validate-model-${timestamp}-${String(sequence).padStart(6, "0")}`;
  };

  return {
    async validateModel(request: ValidateModelRequest): Promise<ValidateModelResult> {
      if (!request.modelPath) {
        throw new Error("validateModel requires modelPath.");
      }
      if (options?.ensureRuntimeReady) {
        await options.ensureRuntimeReady();
      }

      const taskResult = await runtimePort.executeTask({
        requestId: nextRequestId(),
        taskType: "validate-model",
        payload: {
          modelRecordId: request.modelRecordId,
          modelPath: request.modelPath,
          reportOutputDirectory: request.reportOutputDirectory,
          expectedLoRA: request.expectedLoRA,
          expectedRecurrentAdditions: request.expectedRecurrentAdditions,
          validationStrictness: request.validationStrictness,
        },
        timeoutMs: options?.taskTimeoutMs,
      });

      if (!taskResult.success) {
        return {
          modelRecordId: request.modelRecordId,
          status: "invalid",
          errors: [taskResult.error?.message ?? "Model validation task failed."],
        };
      }

      const payload = (taskResult.data ?? {}) as Record<string, unknown>;
      return {
        modelRecordId: String(payload.modelRecordId ?? request.modelRecordId),
        status: (payload.status as ValidateModelResult["status"]) ?? "invalid",
        reportPath: typeof payload.validationReportPath === "string" ? payload.validationReportPath : undefined,
        diffPath: typeof payload.validationDiffPath === "string" ? payload.validationDiffPath : undefined,
        serializationFormat: typeof payload.serializationFormat === "string" ? payload.serializationFormat as ValidateModelResult["serializationFormat"] : undefined,
        shardCount: typeof payload.shardCount === "number" ? payload.shardCount : undefined,
        detectedLoRA: typeof payload.detectedLoRA === "boolean" ? payload.detectedLoRA : undefined,
        detectedRecurrentAdditions: typeof payload.detectedRecurrentAdditions === "boolean" ? payload.detectedRecurrentAdditions : undefined,
        validatedModelPath: typeof payload.validatedModelPath === "string" ? payload.validatedModelPath : undefined,
        validatedAt: typeof payload.validatedAt === "string" ? payload.validatedAt : undefined,
        validationStrictness: payload.validationStrictness === "publish" ? "publish" : "normal",
        tensorChecksCompleted: typeof payload.tensorChecksCompleted === "boolean" ? payload.tensorChecksCompleted : undefined,
        warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : undefined,
        errors: Array.isArray(payload.errors) ? payload.errors.map(String) : undefined,
      };
    },
  };
}
