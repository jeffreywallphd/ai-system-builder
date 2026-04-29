import type { PythonRuntimeTaskStatus } from "./python-runtime-task-status";
import type { RuntimeTaskRecord } from "./runtime-task-record";
import type { TaskType } from "./task-type";

export interface RuntimeTaskListRequest {
  statuses?: PythonRuntimeTaskStatus[];
  taskTypes?: TaskType[];
  includeCompleted?: boolean;
  limit?: number;
}

export interface RuntimeTaskListResult {
  tasks: RuntimeTaskRecord[];
}
