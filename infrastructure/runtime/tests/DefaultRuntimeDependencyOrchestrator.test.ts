import { describe, expect, it } from "bun:test";
import { RuntimeDependencyIds } from "../../../application/runtime/RuntimeDependencyOrchestrator";
import { DefaultRuntimeDependencyOrchestrator } from "../DefaultRuntimeDependencyOrchestrator";

describe("DefaultRuntimeDependencyOrchestrator", () => {
  it("gates dependent runtimes when an upstream runtime is unavailable", async () => {
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-test",
          ensureAvailable: async () => ({
            available: false,
            detail: "Python runtime is unavailable.",
          }),
        },
        {
          dependencyId: RuntimeDependencyIds.mcpRuntime,
          providerId: "mcp-test",
          dependsOn: [RuntimeDependencyIds.pythonRuntime],
          ensureAvailable: async () => ({
            available: true,
            detail: "MCP runtime would be available if dependencies were ready.",
          }),
        },
      ],
    });

    const resolution = await orchestrator.ensureAvailable(RuntimeDependencyIds.mcpRuntime);

    expect(resolution.available).toBeFalse();
    expect(resolution.detail).toContain("depends on python-runtime");
  });

  it("can resolve through a fallback runtime registration", async () => {
    const orchestrator = new DefaultRuntimeDependencyOrchestrator({
      registrations: [
        {
          dependencyId: RuntimeDependencyIds.pythonRuntime,
          providerId: "python-primary",
          fallbackDependencyIds: [RuntimeDependencyIds.mcpRuntime],
          ensureAvailable: async () => ({
            available: false,
            detail: "Primary runtime unavailable.",
          }),
        },
        {
          dependencyId: RuntimeDependencyIds.mcpRuntime,
          providerId: "python-fallback",
          ensureAvailable: async () => ({
            available: true,
            detail: "Fallback runtime available.",
          }),
        },
      ],
    });

    const resolution = await orchestrator.ensureAvailable(RuntimeDependencyIds.pythonRuntime);

    expect(resolution.available).toBeTrue();
    expect(resolution.usedFallback).toBeTrue();
    expect(resolution.resolvedDependencyId).toBe(RuntimeDependencyIds.mcpRuntime);
  });
});
