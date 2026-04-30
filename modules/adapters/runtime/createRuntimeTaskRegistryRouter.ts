import type { RuntimeTaskRegistryPort } from "../../application/ports/runtime";
import { TaskType, type CancelRuntimeTaskResult, type RuntimeTaskListRequest, type RuntimeTaskListResult, type RuntimeTaskRecord, type StartRuntimeTaskRequest, type StartRuntimeTaskResult } from "../../contracts/runtime";

export function createRuntimeTaskRegistryRouter(delegates: { image: RuntimeTaskRegistryPort; python: RuntimeTaskRegistryPort }): RuntimeTaskRegistryPort {
  if (!delegates?.image || !delegates?.python) throw new Error("createRuntimeTaskRegistryRouter requires both image and python delegates.");

  const taskTypeDelegates: Record<TaskType, RuntimeTaskRegistryPort> = {
    [TaskType.IMAGE_GENERATION]: delegates.image,
    [TaskType.DATASET_PREPARATION]: delegates.python,
    [TaskType.MODEL_TRAINING]: delegates.python,
    [TaskType.MODEL_VALIDATION]: delegates.python,
    [TaskType.MODEL_PUBLISHING]: delegates.python,
  };

  const requestToTaskType = new Map<string, TaskType>();
  const unknown = (requestId: string): RuntimeTaskRecord => ({ requestId, taskType: "unknown" as unknown as TaskType, status: "unknown", concurrencyClass: "unknown" });

  return {
    async startTask(request: StartRuntimeTaskRequest): Promise<StartRuntimeTaskResult> {
      const delegate = taskTypeDelegates[request.taskType];
      const result = await delegate.startTask(request);
      requestToTaskType.set(result.requestId, request.taskType);
      return result;
    },
    async getTaskStatus(requestId: string): Promise<RuntimeTaskRecord> {
      const taskType = requestToTaskType.get(requestId);
      if (!taskType) return unknown(requestId);
      return taskTypeDelegates[taskType].getTaskStatus(requestId);
    },
    async cancelTask(requestId: string): Promise<CancelRuntimeTaskResult> {
      const taskType = requestToTaskType.get(requestId);
      return taskType ? taskTypeDelegates[taskType].cancelTask(requestId) : { requestId, cancelled: false, status: "unknown" };
    },
    async listTasks(request: RuntimeTaskListRequest): Promise<RuntimeTaskListResult> {
      if (request.taskType) return taskTypeDelegates[request.taskType].listTasks(request);
      const [image, python] = await Promise.all([delegates.image.listTasks(request), delegates.python.listTasks(request)]);
      return { tasks: [...image.tasks, ...python.tasks] };
    },
  };
}
