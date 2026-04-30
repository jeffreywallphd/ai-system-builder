import type { RuntimeTaskRegistryPort } from "../../application/ports/runtime";
import { TaskType, type CancelRuntimeTaskResult, type RuntimeTaskListRequest, type RuntimeTaskListResult, type RuntimeTaskRecord, type StartRuntimeTaskRequest, type StartRuntimeTaskResult } from "../../contracts/runtime";

export function createRuntimeTaskRegistryRouter(delegates: Record<string, RuntimeTaskRegistryPort>): RuntimeTaskRegistryPort {
  const requestToDelegate = new Map<string, string>();
  const unknown = (requestId: string): RuntimeTaskRecord => ({ requestId, taskType: TaskType.DATASET_PREPARATION, status: "unknown", concurrencyClass: "unknown" });
  return {
    async startTask(request: StartRuntimeTaskRequest): Promise<StartRuntimeTaskResult> {
      const key = request.taskType === TaskType.IMAGE_GENERATION ? "image" : "python";
      const d = delegates[key];
      const result = await d.startTask(request);
      requestToDelegate.set(result.requestId, key);
      return result;
    },
    async getTaskStatus(requestId: string): Promise<RuntimeTaskRecord> { const k = requestToDelegate.get(requestId); return k ? delegates[k].getTaskStatus(requestId) : unknown(requestId); },
    async cancelTask(requestId: string): Promise<CancelRuntimeTaskResult> { const k = requestToDelegate.get(requestId); return k ? delegates[k].cancelTask(requestId) : { requestId, cancelled: false, status: "unknown" }; },
    async listTasks(request: RuntimeTaskListRequest): Promise<RuntimeTaskListResult> { return request.taskType === TaskType.IMAGE_GENERATION ? delegates.image.listTasks(request) : delegates.python.listTasks(request); },
  };
}
