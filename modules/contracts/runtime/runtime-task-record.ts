import type { PythonRuntimeError } from "./python-runtime-error";
import type { PythonRuntimeTaskStatus } from "./python-runtime-task-status";
import type { RuntimeTaskConcurrencyClass } from "./runtime-task-concurrency-class";
import type { RuntimeTaskProgress } from "./runtime-task-progress";
import type { TaskType } from "./task-type";

export interface RuntimeTaskRecord {
  requestId: string;
  taskType: TaskType;
  status: PythonRuntimeTaskStatus;
  concurrencyClass: RuntimeTaskConcurrencyClass;
  progress?: RuntimeTaskProgress;
  data?: unknown;
  error?: PythonRuntimeError;
  metadata?: Record<string, unknown>;
  queuedAt?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}
