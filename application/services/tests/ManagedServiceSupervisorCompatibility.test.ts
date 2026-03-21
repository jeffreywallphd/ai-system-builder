import { describe, expect, it } from "bun:test";
import { mapSupervisorServiceToManagedServiceStatus } from "../adapters/ManagedServiceSupervisorCompatibility";
import { ManagedServiceRestartPolicies, ManagedServiceTransports } from "../ManagedServiceDefinition";
import {
  ManagedServiceKinds,
  ManagedServiceOwnership,
  ManagedServiceStartPolicies,
  ManagedServiceStates,
} from "../interfaces/ManagedServiceTypes";

describe("ManagedServiceSupervisorCompatibility", () => {
  it("maps supervisor health concepts onto generalized managed service status", () => {
    const definition = {
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      description: "Test definition",
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:8000",
      healthCheckPath: "/health",
      workingDirectory: "python-runtime",
      command: "python",
      args: ["-m", "uvicorn"],
      environmentVariables: {},
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
      startupTimeoutMs: 20_000,
      tags: ["python"],
      capabilities: ["workflow-execution"],
    } as const;

    const degraded = mapSupervisorServiceToManagedServiceStatus(definition, {
      serviceId: definition.serviceId,
      name: definition.displayName,
      args: definition.args,
      pid: null,
      startedAt: null,
      lastHealthCheckAt: "2026-03-20T00:00:00.000Z",
      state: "unhealthy",
      ownership: "external",
      detail: "Health check failed.",
      recentLogs: [],
    });

    expect(degraded.state).toBe(ManagedServiceStates.degraded);
    expect(degraded.isAvailable).toBeFalse();
    expect(degraded.ownership).toBe(ManagedServiceOwnership.external);
    expect(degraded.startPolicy).toBe(ManagedServiceStartPolicies.onDemand);

    const running = mapSupervisorServiceToManagedServiceStatus(definition, {
      serviceId: definition.serviceId,
      name: definition.displayName,
      args: definition.args,
      pid: 42,
      startedAt: "2026-03-20T00:00:01.000Z",
      lastHealthCheckAt: "2026-03-20T00:00:02.000Z",
      state: "healthy",
      ownership: "managed",
      detail: "Healthy.",
      recentLogs: [],
    });

    expect(running.state).toBe(ManagedServiceStates.running);
    expect(running.isAvailable).toBeTrue();
    expect(running.ownership).toBe(ManagedServiceOwnership.managed);
    expect(running.lastUpdatedAt).toBe("2026-03-20T00:00:02.000Z");
  });
});
