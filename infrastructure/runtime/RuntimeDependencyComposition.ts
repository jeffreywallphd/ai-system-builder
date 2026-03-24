import {
  RuntimeDependencyIds,
  RuntimeDependencyOperationalStates,
  type RuntimeDependencyProbeResult,
  type RuntimeDependencyRegistration,
} from "../../application/runtime/RuntimeDependencyOrchestrator";
import { DefaultRuntimeDependencyOrchestrator, type DefaultRuntimeDependencyOrchestratorOptions } from "./DefaultRuntimeDependencyOrchestrator";

export interface RuntimeDependencyCompositionOptions {
  readonly pythonRuntime: {
    readonly providerId: string;
    readonly ensureAvailable: () => Promise<RuntimeDependencyProbeResult>;
  };
  readonly mcpRuntime?: {
    readonly providerId?: string;
    readonly ensureAvailable?: () => Promise<RuntimeDependencyProbeResult>;
  };
  readonly additionalRegistrations?: ReadonlyArray<RuntimeDependencyRegistration>;
  readonly cacheTtlMs?: number;
}

export function createRuntimeDependencyRegistrations(
  options: RuntimeDependencyCompositionOptions,
): ReadonlyArray<RuntimeDependencyRegistration> {
  return Object.freeze([
    {
      dependencyId: RuntimeDependencyIds.pythonRuntime,
      providerId: options.pythonRuntime.providerId,
      ensureAvailable: options.pythonRuntime.ensureAvailable,
    },
    {
      dependencyId: RuntimeDependencyIds.mcpRuntime,
      providerId: options.mcpRuntime?.providerId ?? "mcp-runtime-orchestration-gate",
      dependsOn: Object.freeze([RuntimeDependencyIds.pythonRuntime]),
      ensureAvailable: options.mcpRuntime?.ensureAvailable
        ?? (async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
          detail: "MCP runtime dependency gate passed.",
        })),
    },
    ...(options.additionalRegistrations ?? []),
  ]);
}

export function createDependentRuntimeCapabilityRegistration(options: {
  readonly dependencyId: RuntimeDependencyRegistration["dependencyId"];
  readonly providerId: string;
  readonly dependsOn?: ReadonlyArray<RuntimeDependencyRegistration["dependencyId"]>;
  readonly ensureAvailable?: () => Promise<RuntimeDependencyProbeResult>;
}): RuntimeDependencyRegistration {
  return Object.freeze({
    dependencyId: options.dependencyId,
    providerId: options.providerId,
    dependsOn: Object.freeze([...(options.dependsOn ?? [RuntimeDependencyIds.pythonRuntime])]),
    ensureAvailable: options.ensureAvailable
      ?? (async () => ({
        state: RuntimeDependencyOperationalStates.healthy,
        detail: `${options.dependencyId} dependency gate passed.`,
      })),
  });
}

export function createRuntimeDependencyOrchestrator(
  options: RuntimeDependencyCompositionOptions,
): DefaultRuntimeDependencyOrchestrator {
  const orchestratorOptions: DefaultRuntimeDependencyOrchestratorOptions = {
    registrations: createRuntimeDependencyRegistrations(options),
    cacheTtlMs: options.cacheTtlMs,
  };

  return new DefaultRuntimeDependencyOrchestrator(orchestratorOptions);
}
