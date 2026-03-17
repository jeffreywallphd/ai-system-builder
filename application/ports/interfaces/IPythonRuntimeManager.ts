export const PythonRuntimeStatuses = {
  unavailable: "unavailable",
  starting: "starting",
  healthy: "healthy",
  unhealthy: "unhealthy",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
} as const;

export const PythonRuntimeOwnership = {
  external: "external",
  managed: "managed",
  none: "none",
} as const;

export type PythonRuntimeStatus =
  (typeof PythonRuntimeStatuses)[keyof typeof PythonRuntimeStatuses];

export type PythonRuntimeOwner =
  (typeof PythonRuntimeOwnership)[keyof typeof PythonRuntimeOwnership];

export interface PythonRuntimeManagerStatus {
  readonly status: PythonRuntimeStatus;
  readonly isAvailable: boolean;
  readonly owner: PythonRuntimeOwner;
  readonly lastUpdatedAt: string;
  readonly detail?: string;
}

export interface IPythonRuntimeManager {
  checkAvailability(): Promise<boolean>;
  ensureRuntimeAvailability(): Promise<PythonRuntimeManagerStatus>;
  getStatus(): PythonRuntimeManagerStatus;
  stopManagedRuntime(): Promise<void>;
}
