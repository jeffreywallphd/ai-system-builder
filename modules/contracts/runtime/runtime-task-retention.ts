export interface RuntimeTaskRetentionPolicy {
  completedTaskTtlMs?: number;
  maxCompletedTasks?: number;
  cleanupIntervalMs?: number;
}
