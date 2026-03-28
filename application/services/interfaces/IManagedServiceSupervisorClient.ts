import type { ManagedServiceDefinition } from "../ManagedServiceDefinition";

export const ManagedSupervisorServiceStates = {
  unavailable: "unavailable",
  starting: "starting",
  healthy: "healthy",
  unhealthy: "unhealthy",
  failed: "failed",
  stopping: "stopping",
  stopped: "stopped",
} as const;

export const ManagedSupervisorProvisioningStates = {
  unsupported: "unsupported",
  unprovisioned: "unprovisioned",
  provisioning: "provisioning",
  provisioned: "provisioned",
  provisionedUnlaunchable: "provisioned-unlaunchable",
  provisionFailed: "provision-failed",
  corrupted: "corrupted",
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

export type ManagedSupervisorProvisioningState =
  (typeof ManagedSupervisorProvisioningStates)[keyof typeof ManagedSupervisorProvisioningStates];

export interface ManagedSupervisorServiceLogEntry {
  readonly timestamp: string;
  readonly level: "info" | "success" | "warning" | "error" | "stdout" | "stderr";
  readonly message: string;
}

export interface ManagedSupervisorServiceProcessHistoryEntry {
  readonly observedAt: string;
  readonly pid: number | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly ownership: ManagedSupervisorServiceOwnership;
  readonly outcome: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly detail: string;
}

export interface ManagedSupervisorCircuitBreakerState {
  readonly state: "open" | "closed";
  readonly openedAt: string | null;
  readonly retryAfter: string | null;
  readonly recentFailures: number;
  readonly maxFailures: number;
  readonly failureWindowMs: number;
  readonly cooldownMs: number;
}

export interface ManagedSupervisorServiceDiagnostics {
  readonly lastError: {
    readonly at: string;
    readonly category: string;
    readonly message: string;
    readonly code: string | null;
    readonly details: Readonly<Record<string, unknown>>;
  } | null;
  readonly lastExit: {
    readonly at: string;
    readonly code: number | null;
    readonly signal: string | null;
    readonly expected: boolean;
  } | null;
  readonly lastStart: {
    readonly at: string;
    readonly command: string | null;
    readonly args: ReadonlyArray<string>;
    readonly cwd: string;
  } | null;
  readonly lastHealthProbe: {
    readonly at: string;
    readonly healthy: boolean;
    readonly detail: string;
    readonly url: string | null;
    readonly statusCode: number | null;
    readonly durationMs: number | null;
    readonly errorCode: string | null;
  } | null;
  readonly circuitBreaker: ManagedSupervisorCircuitBreakerState;
  readonly provisioning: {
    readonly state: ManagedSupervisorProvisioningState;
    readonly required: boolean;
    readonly requestedVersion: string | null;
    readonly resolvedVersion: string | null;
    readonly resolvedInterpreter: string | null;
    readonly environmentPath: string | null;
    readonly versionMismatch: boolean;
    readonly needsReprovision: boolean;
    readonly lastUpdatedAt: string | null;
    readonly lastError: {
      readonly at: string;
      readonly message: string;
      readonly code: string | null;
      readonly details: Readonly<Record<string, unknown>>;
    } | null;
  };
}

export interface ManagedSupervisorServiceMetadata {
  readonly version: string;
  readonly compatibility: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

export interface ManagedSupervisorServiceRecord {
  readonly serviceId: string;
  readonly name: string;
  readonly command?: string;
  readonly args: ReadonlyArray<string>;
  readonly dependencies?: ReadonlyArray<string>;
  readonly dependents?: ReadonlyArray<string>;
  readonly cwd?: string;
  readonly baseUrl?: string;
  readonly pid: number | null;
  readonly startedAt: string | null;
  readonly lastHealthCheckAt: string | null;
  readonly state: ManagedSupervisorServiceState;
  readonly ownership: ManagedSupervisorServiceOwnership;
  readonly detail?: string;
  readonly readiness?: {
    readonly isReady: boolean;
    readonly detail: string;
    readonly blockedBy: ReadonlyArray<string>;
  };
  readonly recentLogs: ReadonlyArray<ManagedSupervisorServiceLogEntry>;
  readonly processHistory: ReadonlyArray<ManagedSupervisorServiceProcessHistoryEntry>;
  readonly metadata: ManagedSupervisorServiceMetadata;
  readonly diagnostics: ManagedSupervisorServiceDiagnostics;
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

export interface ManagedSupervisorServiceDefinitionListResponse {
  readonly ok: boolean;
  readonly definitions: ReadonlyArray<ManagedServiceDefinition>;
}

export interface ManagedSupervisorServiceDefinitionResponse {
  readonly ok: boolean;
  readonly definition: ManagedServiceDefinition;
}

export interface IManagedServiceSupervisorClient {
  health(): Promise<ManagedSupervisorHealthResponse>;
  listServices(): Promise<ManagedSupervisorServiceListResponse>;
  getService(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  listDefinitions(): Promise<ManagedSupervisorServiceDefinitionListResponse>;
  getDefinition(serviceId: string): Promise<ManagedSupervisorServiceDefinitionResponse>;
  saveDefinition(definition: ManagedServiceDefinition): Promise<ManagedSupervisorServiceDefinitionResponse>;
  deleteDefinition(serviceId: string): Promise<void>;
  start(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  stop(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  restart(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  ensureRunning(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  provision(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  repair(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
  recreateEnvironment(serviceId: string): Promise<ManagedSupervisorServiceResponse>;
}
