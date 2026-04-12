import { describe, expect, it } from "bun:test";
import {
  RuntimeDependencyIds,
  RuntimeDependencyOperationalStates,
} from "@application/runtime/RuntimeDependencyOrchestrator";
import { DefaultRuntimeDependencyOrchestrator } from "../DefaultRuntimeDependencyOrchestrator";

describe("DefaultRuntimeDependencyOrchestrator", () => {
  it("surfaces richer dependency state when an upstream runtime is unavailable", async () => {
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => ({
            state: RuntimeDependencyOperationalStates.unavailable,
            detail: "Python runtime is unavailable.",
            remediationHints: ["Start the Python runtime service."],
          }),
        },
        {
          dependencyId: RuntimeDependencyIds.mcpRuntime,
          providerId: "mcp-test",
          dependsOn: [RuntimeDependencyIds.pythonRuntime],
          ensureAvailable: async () => ({
            state: RuntimeDependencyOperationalStates.healthy,
            detail: "MCP runtime would be available if dependencies were ready.",
          }),
        },
      ],
    });

    const resolution = await orchestrator.ensureAvailable(RuntimeDependencyIds.mcpRuntime);

    expect(resolution.available).toBeFalse();
    expect(resolution.state).toBe(RuntimeDependencyOperationalStates.unavailable);
    expect(resolution.availability).toBe("unavailable");
    expect(resolution.health).toBe("unavailable");
    expect(resolution.detail).toContain("depends on python-runtime");
    expect(resolution.remediationHints).toContain("Start the Python runtime service.");
  });

  it("marks fallback resolutions as degraded even when the fallback dependency is healthy", async () => {
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-primary",
          fallbackDependencyIds: [RuntimeDependencyIds.mcpRuntime],
          ensureAvailable: async () => ({
            state: RuntimeDependencyOperationalStates.failed,
            detail: "Primary runtime unavailable.",
          }),
        },
        {
          dependencyId: RuntimeDependencyIds.mcpRuntime,
          providerId: "python-fallback",
          ensureAvailable: async () => ({
            state: RuntimeDependencyOperationalStates.healthy,
            detail: "Fallback runtime available.",
          }),
        },
      ],
    });

    const resolution = await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);

    expect(resolution.available).toBeTrue();
    expect(resolution.degraded).toBeTrue();
    expect(resolution.availability).toBe("degraded");
    expect(resolution.usedFallback).toBeTrue();
    expect(resolution.resolvedDependencyId).toBe(RuntimeDependencyIds.mcpRuntime);
  });

  it("refreshes a dependency by bypassing the cached resolution", async () => {
    let checks = 0;
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      cacheTtlMs: 60_000,
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => {
            checks += 1;
            return {
              state: checks === 1
                ? RuntimeDependencyOperationalStates.starting
                : RuntimeDependencyOperationalStates.healthy,
              detail: `Check ${checks}`,
            };
          },
        },
      ],
    });

    const initial = await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);
    const cached = await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);
    const refreshed = await orchestrator.refresh(RuntimeDependencyIds.pythonRuntime);

    expect(initial.state).toBe(RuntimeDependencyOperationalStates.starting);
    expect(cached.checkedAt).toBe(initial.checkedAt);
    expect(refreshed.state).toBe(RuntimeDependencyOperationalStates.healthy);
    expect(refreshed.detail).toBe("Check 2");
    expect(checks).toBe(2);
  });

  it("invalidates one dependency without clearing unrelated cached entries", async () => {
    let pythonChecks = 0;
    let mcpChecks = 0;
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      cacheTtlMs: 60_000,
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => {
            pythonChecks += 1;
            return {
              state: RuntimeDependencyOperationalStates.healthy,
              detail: `Python ${pythonChecks}`,
            };
          },
        },
        {
          dependencyId: RuntimeDependencyIds.mcpRuntime,
          providerId: "mcp-test",
          ensureAvailable: async () => {
            mcpChecks += 1;
            return {
              state: RuntimeDependencyOperationalStates.healthy,
              detail: `MCP ${mcpChecks}`,
            };
          },
        },
      ],
    });

    await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);
    await orchestrator.ensureAvailable(RuntimeDependencyIds.mcpRuntime);
    orchestrator.invalidate(RuntimeDependencyIds.pythonRuntime);
    await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);
    await orchestrator.ensureAvailable(RuntimeDependencyIds.mcpRuntime);

    expect(pythonChecks).toBe(2);
    expect(mcpChecks).toBe(1);
  });

  it("invalidates dependent runtime resolutions when an upstream dependency changes", async () => {
    let pythonChecks = 0;
    let modelTrainingChecks = 0;
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      cacheTtlMs: 60_000,
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => {
            pythonChecks += 1;
            return {
              state: RuntimeDependencyOperationalStates.healthy,
              detail: `Python ${pythonChecks}`,
            };
          },
        },
        {
          dependencyId: RuntimeDependencyIds.modelTrainingRuntime,
          providerId: "model-training-test",
          dependsOn: [RuntimeDependencyIds.pythonRuntime],
          ensureAvailable: async () => {
            modelTrainingChecks += 1;
            return {
              state: RuntimeDependencyOperationalStates.healthy,
              detail: `Training ${modelTrainingChecks}`,
            };
          },
        },
      ],
    });

    await orchestrator.ensureAvailable(RuntimeDependencyIds.modelTrainingRuntime);
    orchestrator.invalidate(RuntimeDependencyIds.pythonRuntime);
    await orchestrator.ensureAvailable(RuntimeDependencyIds.modelTrainingRuntime);

    expect(pythonChecks).toBe(2);
    expect(modelTrainingChecks).toBe(2);
  });

  it("invalidates all cached dependency resolutions", async () => {
    let checks = 0;
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      cacheTtlMs: 60_000,
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => {
            checks += 1;
            return {
              state: RuntimeDependencyOperationalStates.healthy,
              detail: `Python ${checks}`,
            };
          },
        },
      ],
    });

    await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);
    orchestrator.invalidateAll();
    await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);

    expect(checks).toBe(2);
  });
});

