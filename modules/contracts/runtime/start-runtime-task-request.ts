import type { RuntimeTaskConcurrencyClass } from "./runtime-task-concurrency-class";
import type { TaskType } from "./task-type";

export interface StartRuntimeTaskRequest {
  taskType: TaskType;
  concurrencyClass?: RuntimeTaskConcurrencyClass;
  payload: unknown;
  metadata?: Record<string, unknown>;
}
