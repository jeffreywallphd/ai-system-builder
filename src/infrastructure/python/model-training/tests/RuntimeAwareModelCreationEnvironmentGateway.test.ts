import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../config/AppRuntimeConfig";
import { RuntimeDependencyIds, RuntimeDependencyOperationalStates } from "@application/runtime/RuntimeDependencyOrchestrator";
import { RuntimeAwareModelCreationEnvironmentGateway } from "../RuntimeAwareModelCreationEnvironmentGateway";

describe("RuntimeAwareModelCreationEnvironmentGateway", () => {
  it("surfaces orchestration detail and remediation hints when model training is still starting", async () => {
    const gateway = new RuntimeAwareModelCreationEnvironmentGateway(
      AppRuntimeConfig.forDevelopment(),
      {
        health: async () => ({ status: "ok", runtime: "python" } as const),
      } as any,
      true,
      undefined,
      "Desktop bridge unavailable.",
      {
        ensureAvailable: async (dependencyId) => ({
          requestedDependencyId: dependencyId,
          resolvedDependencyId: dependencyId,
          providerId: "model-training-gate",
          state: RuntimeDependencyOperationalStates.starting,
          health: "degraded",
          availability: "degraded",
          available: false,
          degraded: false,
          checkedAt: new Date().toISOString(),
          dependencyChain: [RuntimeDependencyIds.pythonRuntime, RuntimeDependencyIds.modelTrainingRuntime],
          fallbackDependencyIds: [],
          usedFallback: false,
          detail: "Model training runtime is starting.",
          remediationHints: ["Wait for the runtime to finish starting."],
        }),
        refresh: async () => { throw new Error("unused"); },
        invalidate: () => undefined,
        invalidateAll: () => undefined,
        listRegistrations: () => [],
      },
    );

    const environment = await gateway.getEnvironment();

    expect(environment.runtimeStatus).toBe("degraded");
    expect(environment.runtimeDependencyStatus).toBeDefined();
    expect(environment.runtimeDetail).toContain("Model training runtime is starting.");
    expect(environment.runtimeRemediationHints).toContain("Wait for the runtime to finish starting.");
  });
});

