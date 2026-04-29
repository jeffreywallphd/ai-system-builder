import type { RuntimeTaskRegistryPort } from "../../../application/ports/runtime";
import type { PythonRuntimePort } from "../../../application/ports/runtime";
import type {
  CancelRuntimeTaskResult,
  RuntimeTaskRecord,
  RuntimeTaskStatus,
  StartRuntimeTaskRequest,
  StartRuntimeTaskResult,
  RuntimeTaskListRequest,
  RuntimeTaskListResult,
} from "../../../contracts/runtime";
import { TaskType } from "../../../contracts/runtime";

function mapTaskType(taskType: string): RuntimeTaskRecord["taskType"] {
  if (taskType === "prepare-training-dataset") {
    return TaskType.DATASET_PREPARATION;
  }
  if (taskType === "train-model") {
    return TaskType.MODEL_TRAINING;
  }
  if (taskType === "validate-model") {
    return TaskType.MODEL_VALIDATION;
  }
  return TaskType.MODEL_PUBLISHING;
}

export function createPythonRuntimeTaskRegistryAdapter(runtimePort: PythonRuntimePort): RuntimeTaskRegistryPort {
  return {
    async startTask(request: StartRuntimeTaskRequest): Promise<StartRuntimeTaskResult> {
      return runtimePort.startTask({
        requestId: request.requestId ?? `runtime-task-${Date.now()}`,
        taskType: request.taskType,
        payload: request.payload,
        metadata: request.metadata,
      });
    },
    async getTaskStatus(requestId: string): Promise<RuntimeTaskRecord> {
      const status = await runtimePort.readTaskStatus(requestId);
      return {
        requestId: status.requestId,
        taskType: mapTaskType(status.taskType ?? "prepare-training-dataset"),
        status: status.status,
        concurrencyClass: "unknown",
        progress: status.progress,
        data: status.data,
        error: status.error,
        metadata: status.metadata,
        startedAt: status.startedAt,
        updatedAt: status.updatedAt,
      };
    },
    async cancelTask(requestId: string): Promise<CancelRuntimeTaskResult> {
      const result = await runtimePort.cancelTask(requestId);
      return {
        requestId: result.requestId,
        cancelled: result.cancelled,
        status: result.cancelled ? "cancelled" : "unknown",
      };
    },
    async listTasks(_request: RuntimeTaskListRequest): Promise<RuntimeTaskListResult> {
      return { tasks: [] };
    },
  };
}
