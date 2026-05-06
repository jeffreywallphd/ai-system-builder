import {
  RUNTIME_CAPABILITY_IDS,
  createRuntimeCapabilityStatus,
  type RuntimeCapabilityDependencyStatus,
  type RuntimeCapabilityId,
  type RuntimeCapabilityStatus,
  type RuntimeReadinessAction,
  type RuntimeReadinessSnapshot,
  type RuntimeReadinessStatus,
} from "../../../contracts/runtime";
import type { RuntimeInstallStatus } from "../../../contracts/runtime-installer";
import type { RuntimeReadinessPort } from "../../ports/runtime";

export type PythonRuntimeLifecycleState = "stopped" | "starting" | "ready" | "failed";
export type ComfyUiRuntimeLifecycleState = "stopped" | "starting" | "ready" | "unhealthy";

export interface RuntimeCapabilityStatusProvider {
  capabilityId: RuntimeCapabilityId;
  getStatus(): RuntimeCapabilityStatus | Promise<RuntimeCapabilityStatus>;
}

export interface RuntimeReadinessServiceOptions {
  providers: readonly RuntimeCapabilityStatusProvider[];
  now?: () => string;
}

export interface PythonRuntimeCapabilityStatusProviderOptions {
  readState: () => PythonRuntimeLifecycleState | Promise<PythonRuntimeLifecycleState>;
  now?: () => string;
}

export interface ComfyUiRuntimeCapabilityStatusProviderOptions {
  readState: () => ComfyUiRuntimeLifecycleState | Promise<ComfyUiRuntimeLifecycleState>;
  now?: () => string;
}

export interface RuntimeInstallerCapabilityStatusProviderOptions {
  capabilityId: RuntimeCapabilityId;
  readStatus: () => RuntimeInstallStatus | Promise<RuntimeInstallStatus>;
  targetId?: string;
  now?: () => string;
}

export interface DerivedRuntimeCapabilityStatusProviderOptions {
  capabilityId: RuntimeCapabilityId;
  dependencies: readonly RuntimeCapabilityId[];
  readDependencyStatus: (capabilityId: RuntimeCapabilityId) => RuntimeCapabilityStatus | Promise<RuntimeCapabilityStatus>;
  now?: () => string;
}

const DEFAULT_NOW = () => new Date().toISOString();

const SNAPSHOT_STATUS_PRIORITY: readonly RuntimeReadinessStatus[] = [
  "failed",
  "installing",
  "starting",
  "not-installed",
  "degraded",
  "unavailable",
  "unknown",
  "ready",
];

const DERIVED_BLOCKING_STATUS_PRIORITY: readonly RuntimeReadinessStatus[] = [
  "failed",
  "not-installed",
  "installing",
  "starting",
  "unavailable",
  "unknown",
  "degraded",
  "ready",
];

function providerFailureStatus(
  capabilityId: RuntimeCapabilityId,
  error: unknown,
  now: () => string,
): RuntimeCapabilityStatus {
  return createRuntimeCapabilityStatus({
    capabilityId,
    status: "failed",
    summary: `Unable to read ${capabilityId} readiness provider.`,
    reason: {
      code: "runtime.readiness.provider-failed",
      message: error instanceof Error ? error.message : "Runtime readiness provider failed.",
      category: "unknown",
      retryable: true,
    },
    recommendedActions: ["retry", "view-logs"],
    updatedAt: now(),
  });
}

function highestPriorityStatus(
  statuses: readonly RuntimeReadinessStatus[],
  priority: readonly RuntimeReadinessStatus[],
): RuntimeReadinessStatus {
  for (const status of priority) {
    if (statuses.includes(status)) {
      return status;
    }
  }
  return "unknown";
}

function isCapabilityAvailable(status: RuntimeCapabilityStatus): boolean {
  return status.available === true;
}

function statusActions(status: RuntimeReadinessStatus): RuntimeReadinessAction[] | undefined {
  switch (status) {
    case "not-installed":
      return ["install"];
    case "installing":
    case "starting":
      return ["wait"];
    case "unavailable":
      return ["start"];
    case "failed":
      return ["retry", "view-logs"];
    case "unknown":
      return ["retry"];
    case "degraded":
      return ["view-logs"];
    case "ready":
      return undefined;
  }
}

export function mapPythonRuntimeLifecycleStateToReadinessStatus(
  state: PythonRuntimeLifecycleState,
): RuntimeReadinessStatus {
  switch (state) {
    case "stopped":
      return "unavailable";
    case "starting":
      return "starting";
    case "ready":
      return "ready";
    case "failed":
      return "failed";
  }
}

export function mapComfyUiRuntimeLifecycleStateToReadinessStatus(
  state: ComfyUiRuntimeLifecycleState,
): RuntimeReadinessStatus {
  switch (state) {
    case "stopped":
      return "unavailable";
    case "starting":
      return "starting";
    case "ready":
      return "ready";
    case "unhealthy":
      return "failed";
  }
}

export function mapRuntimeInstallStatusToReadinessStatus(
  status: RuntimeInstallStatus,
): RuntimeReadinessStatus {
  switch (status) {
    case "not-installed":
      return "not-installed";
    case "installing":
    case "checking":
      return "installing";
    case "installed":
      return "unknown";
    case "update-available":
      return "degraded";
    case "failed":
      return "failed";
    case "unknown":
      return "unknown";
  }
}

export class RuntimeReadinessService implements RuntimeReadinessPort {
  private readonly providersByCapabilityId: Map<RuntimeCapabilityId, RuntimeCapabilityStatusProvider>;
  private readonly now: () => string;

  public constructor(options: RuntimeReadinessServiceOptions) {
    this.now = options.now ?? DEFAULT_NOW;
    this.providersByCapabilityId = new Map();

    for (const provider of options.providers) {
      if (this.providersByCapabilityId.has(provider.capabilityId)) {
        throw new Error(`Duplicate runtime readiness provider for capability '${provider.capabilityId}'.`);
      }
      this.providersByCapabilityId.set(provider.capabilityId, provider);
    }
  }

  public async getCapabilityStatus(capabilityId: RuntimeCapabilityId): Promise<RuntimeCapabilityStatus> {
    const provider = this.providersByCapabilityId.get(capabilityId);
    if (!provider) {
      return createRuntimeCapabilityStatus({
        capabilityId,
        status: "unknown",
        summary: `No runtime readiness provider is composed for ${capabilityId}.`,
        reason: {
          code: "runtime.readiness.provider-missing",
          message: `No runtime readiness provider is composed for ${capabilityId}.`,
          category: "unknown",
          retryable: false,
        },
        recommendedActions: ["configure"],
        updatedAt: this.now(),
      });
    }

    try {
      return await provider.getStatus();
    } catch (error) {
      return providerFailureStatus(capabilityId, error, this.now);
    }
  }

  public async getReadinessSnapshot(): Promise<RuntimeReadinessSnapshot> {
    const capabilities = await Promise.all(
      RUNTIME_CAPABILITY_IDS.map((capabilityId) => this.getCapabilityStatus(capabilityId)),
    );
    const status = this.aggregateSnapshotStatus(capabilities);
    const available = capabilities.some(isCapabilityAvailable);
    const healthy = capabilities.length > 0 && capabilities.every((capability) => capability.healthy === true);
    const recommendedActions = Array.from(
      new Set(capabilities.flatMap((capability) => capability.recommendedActions ?? [])),
    );

    return {
      status,
      healthy,
      available,
      capabilities,
      summary: this.snapshotSummary(status),
      recommendedActions: recommendedActions.length > 0 ? recommendedActions : undefined,
      updatedAt: this.now(),
    };
  }

  private aggregateSnapshotStatus(capabilities: readonly RuntimeCapabilityStatus[]): RuntimeReadinessStatus {
    if (capabilities.length === 0) {
      return "unknown";
    }
    if (capabilities.every((capability) => capability.status === "ready")) {
      return "ready";
    }
    if (capabilities.some(isCapabilityAvailable)) {
      if (capabilities.some((capability) => capability.status === "failed")) {
        return "failed";
      }
      return "degraded";
    }
    return highestPriorityStatus(capabilities.map((capability) => capability.status), SNAPSHOT_STATUS_PRIORITY);
  }

  private snapshotSummary(status: RuntimeReadinessStatus): string {
    switch (status) {
      case "ready":
        return "All runtime capabilities are ready.";
      case "degraded":
        return "Some runtime capabilities are available with limitations.";
      case "failed":
        return "One or more runtime capabilities failed readiness checks.";
      case "installing":
        return "One or more runtime capabilities are installing or checking installation.";
      case "starting":
        return "One or more runtime capabilities are starting.";
      case "not-installed":
        return "One or more runtime capabilities are not installed.";
      case "unavailable":
        return "Runtime capabilities are unavailable on this host.";
      case "unknown":
        return "Runtime capability readiness is unknown.";
    }
  }
}

export function createPythonRuntimeCapabilityStatusProvider(
  options: PythonRuntimeCapabilityStatusProviderOptions,
): RuntimeCapabilityStatusProvider {
  const now = options.now ?? DEFAULT_NOW;
  return {
    capabilityId: "python-runtime",
    async getStatus() {
      const state = await options.readState();
      const status = mapPythonRuntimeLifecycleStateToReadinessStatus(state);
      return createRuntimeCapabilityStatus({
        capabilityId: "python-runtime",
        status,
        summary: `Python runtime is ${state}.`,
        reason: status === "ready" ? undefined : {
          code: `runtime.python.${state}`,
          message: `Python runtime is ${state}.`,
          category: state === "failed" ? "startup" : "unavailable",
          retryable: state !== "starting",
        },
        recommendedActions: statusActions(status),
        updatedAt: now(),
      });
    },
  };
}

export function createComfyUiRuntimeCapabilityStatusProvider(
  options: ComfyUiRuntimeCapabilityStatusProviderOptions,
): RuntimeCapabilityStatusProvider {
  const now = options.now ?? DEFAULT_NOW;
  return {
    capabilityId: "comfyui-runtime",
    async getStatus() {
      const state = await options.readState();
      const status = mapComfyUiRuntimeLifecycleStateToReadinessStatus(state);
      return createRuntimeCapabilityStatus({
        capabilityId: "comfyui-runtime",
        status,
        summary: `ComfyUI runtime is ${state}.`,
        reason: status === "ready" ? undefined : {
          code: `runtime.comfyui.${state}`,
          message: `ComfyUI runtime is ${state}.`,
          category: state === "unhealthy" ? "health" : "unavailable",
          retryable: state !== "starting",
        },
        recommendedActions: statusActions(status),
        updatedAt: now(),
      });
    },
  };
}

export function createRuntimeInstallerCapabilityStatusProvider(
  options: RuntimeInstallerCapabilityStatusProviderOptions,
): RuntimeCapabilityStatusProvider {
  const now = options.now ?? DEFAULT_NOW;
  return {
    capabilityId: options.capabilityId,
    async getStatus() {
      const installStatus = await options.readStatus();
      const status = mapRuntimeInstallStatusToReadinessStatus(installStatus);
      return createRuntimeCapabilityStatus({
        capabilityId: options.capabilityId,
        status,
        summary: `Runtime install status is ${installStatus}.`,
        details: {
          installStatus,
          targetId: options.targetId,
        },
        reason: status === "ready" ? undefined : {
          code: `runtime.install.${installStatus}`,
          message: installStatus === "installed"
            ? "Runtime is installed; process readiness must be read from its supervisor."
            : `Runtime install status is ${installStatus}.`,
          category: "installation",
          retryable: installStatus === "failed" || installStatus === "unknown",
        },
        recommendedActions: statusActions(status),
        updatedAt: now(),
      });
    },
  };
}

export function createDerivedRuntimeCapabilityStatusProvider(
  options: DerivedRuntimeCapabilityStatusProviderOptions,
): RuntimeCapabilityStatusProvider {
  const now = options.now ?? DEFAULT_NOW;
  return {
    capabilityId: options.capabilityId,
    async getStatus() {
      const dependencies = await Promise.all(
        options.dependencies.map(async (dependencyId): Promise<RuntimeCapabilityDependencyStatus> => {
          try {
            const dependency = await options.readDependencyStatus(dependencyId);
            return {
              capabilityId: dependency.capabilityId,
              status: dependency.status,
              healthy: dependency.healthy,
              available: dependency.available,
              summary: dependency.summary,
              reason: dependency.reason,
              updatedAt: dependency.updatedAt,
            };
          } catch (error) {
            const failed = providerFailureStatus(dependencyId, error, now);
            return {
              capabilityId: failed.capabilityId,
              status: failed.status,
              healthy: failed.healthy,
              available: failed.available,
              summary: failed.summary,
              reason: failed.reason,
              updatedAt: failed.updatedAt,
            };
          }
        }),
      );
      const status = deriveFeatureStatus(dependencies);
      const unavailableDependencies = dependencies.filter((dependency) => dependency.available !== true);

      return createRuntimeCapabilityStatus({
        capabilityId: options.capabilityId,
        status,
        summary: status === "ready"
          ? `${options.capabilityId} is ready.`
          : `${options.capabilityId} is ${status} because required runtime dependencies are not ready.`,
        reason: status === "ready" ? undefined : {
          code: "runtime.capability.dependency-not-ready",
          message: `${options.capabilityId} depends on ${unavailableDependencies.map((dependency) => dependency.capabilityId).join(", ")}.`,
          category: "dependency",
          retryable: true,
        },
        recommendedActions: statusActions(status),
        dependencies,
        updatedAt: now(),
      });
    },
  };
}

function deriveFeatureStatus(dependencies: readonly RuntimeCapabilityDependencyStatus[]): RuntimeReadinessStatus {
  if (dependencies.length === 0) {
    return "unknown";
  }
  if (dependencies.every((dependency) => dependency.status === "ready")) {
    return "ready";
  }
  if (dependencies.every((dependency) => dependency.available === true)) {
    return "degraded";
  }
  return highestPriorityStatus(dependencies.map((dependency) => dependency.status), DERIVED_BLOCKING_STATUS_PRIORITY);
}
