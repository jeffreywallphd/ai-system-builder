import { describe, expect, it } from "bun:test";
import {
  RuntimeDependencyIds,
  RuntimeDependencyOperationalStates,
} from "@application/runtime/RuntimeDependencyOrchestrator";
import {
  createDependentRuntimeCapabilityRegistration,
  createRuntimeDependencyOrchestrator,
  createRuntimeDependencyRegistrations,
} from "../RuntimeDependencyComposition";

describe("RuntimeDependencyComposition", () => {
  it("creates the shared Python -> MCP dependency graph", () => {
    const registrations = createRuntimeDependencyRegistrations({
      pythonRuntime: {
        providerId: "python-provider",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
        }),
      },
    });

    expect(registrations.map((registration) => registration.dependencyId)).toEqual([
      RuntimeDependencyIds.pythonRuntime,
      RuntimeDependencyIds.mcpRuntime,
    ]);
    expect(registrations[1]?.dependsOn).toEqual([RuntimeDependencyIds.pythonRuntime]);
  });

  it("appends additional runtime-backed capability registrations to the shared graph", () => {
    const registrations = createRuntimeDependencyRegistrations({
      pythonRuntime: {
        providerId: "python-provider",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.healthy,
        }),
      },
      additionalRegistrations: [
        createDependentRuntimeCapabilityRegistration({
          dependencyId: RuntimeDependencyIds.documentConversionRuntime,
          providerId: "document-conversion-gate",
        }),
      ],
    });

    expect(registrations.map((registration) => registration.dependencyId)).toEqual([
      RuntimeDependencyIds.pythonRuntime,
      RuntimeDependencyIds.mcpRuntime,
      RuntimeDependencyIds.documentConversionRuntime,
    ]);
    expect(registrations[2]?.dependsOn).toEqual([RuntimeDependencyIds.pythonRuntime]);
  });

  it("lets different composition roots inject their own Python runtime health adapters", async () => {
    const orchestrator = createRuntimeDependencyOrchestrator({
      pythonRuntime: {
        providerId: "ui-python-runtime-manager",
        ensureAvailable: async () => ({
          state: RuntimeDependencyOperationalStates.degraded,
          detail: "Python runtime is reachable but recovering.",
          isDegraded: true,
        }),
      },
    });

    const resolution = await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);

    expect(resolution.providerId).toBe("ui-python-runtime-manager");
    expect(resolution.state).toBe(RuntimeDependencyOperationalStates.degraded);
    expect(resolution.available).toBeTrue();
    expect(resolution.degraded).toBeTrue();
  });
});

