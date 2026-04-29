import type { TaskType } from "../../contracts/runtime";

export interface RuntimeTaskIdentity {
  requestId: string;
  taskType: TaskType;
}
