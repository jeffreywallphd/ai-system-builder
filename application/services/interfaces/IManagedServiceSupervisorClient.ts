export const ManagedSupervisorServiceStates = {
  unavailable: "unavailable",
  starting: "starting",
  healthy: "healthy",
  unhealthy: "unhealthy",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
} as const;

export const ManagedSupervisorServiceOwnership = {
  none: "none",
  managed: "managed",
  external: "external",
} as const;

export type ManagedSupervisorServiceState =
  (typeof ManagedSupervisorServiceStates)[keyof typeof ManagedSupervisorServiceStates];

export type ManagedSupervisorServiceOwnership =
  (typeof ManagedSupervisorServiceOwnership)[keyof typeof ManagedSupervisorServiceOwnership];

export interface ManagedSupervisorServiceLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "success" | "warning" | "error";
  readonly message: string;
}

export interface ManagedSupervisorServiceRecord {
  readonly serviceId: string;
  readonly name: string;
  readonly command?: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd?: string;
  readonly baseUrl?: string;
  readonly pid: number | null;
  readonly startedAt: string | null;
  readonly lastHealthCheckAt: string | null;
  readonly state: ManagedSupervisorServiceState;
  readonly ownership: ManagedSupervisorServiceOwnership;
  readonly detail?: string;
  readonly recentLogs: ReadonlyArray<ManagedSupervisorServiceLogEntry>;
}

export interface ManagedSupervisorHealthResponse {
  readonly ok: boolean;
  readonly mode: string;
  readonly host: string;
  readonly port: number;
  readonly serviceCount: number;
  readonly services: ReadonlyArray<ManagedSupervisorServiceRecord>;
}

export interface ManagedSupervisorServiceListResponse {
  readonly ok: boolean;
  readonly services: ReadonlyArray<ManagedSupervisorServiceRecord>;
}

export interface ManagedSupervisorServiceResponse {
  readonly ok: boolean;
  readonly service: ManagedSupervisorServiceRecord;
}

export interface IManagedServiceSupervisorClient {
  health(): Promise<ManagedSupervisorHealthResponse>;
  listServices(): Promise<ManagedSupervisorServiceListResponse>;
  getService(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  start(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  stop(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  restart(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  ensureRunning(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
}
