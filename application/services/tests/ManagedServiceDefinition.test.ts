import { describe, expect, it } from "bun:test";
import {
  ManagedServiceRestartPolicies,
  ManagedServiceTransports,
  validateManagedServiceDefinition,
} from "../ManagedServiceDefinition";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "../interfaces/ManagedServiceTypes";

describe("ManagedServiceDefinition", () => {
  it("normalizes a valid managed service definition", () => {
    const definition = validateManagedServiceDefinition({
      serviceId: " python-runtime ",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: " Python runtime ",
      description: " Built-in runtime ",
      transport: ManagedServiceTransports.http,
      baseUrl: " http://127.0.0.1:8000 ",
      healthCheckPath: " /health ",
      workingDirectory: " python-runtime ",
      command: " python ",
      args: [" -m ", " uvicorn "],
      environmentVariables: { PYTHONUNBUFFERED: " 1 " },
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
      startupTimeoutMs: 20_000,
      tags: [" builtin "],
      capabilities: [" workflow-execution "],
    });

    expect(definition.serviceId).toBe("python-runtime");
    expect(definition.displayName).toBe("Python runtime");
    expect(definition.baseUrl).toBe("http://127.0.0.1:8000");
    expect(definition.healthCheckPath).toBe("/health");
    expect(definition.args).toEqual(["-m", "uvicorn"]);
    expect(definition.environmentVariables).toEqual({ PYTHONUNBUFFERED: "1" });
    expect(definition.tags).toEqual(["builtin"]);
  });

  it("rejects invalid health check paths and startup timeouts", () => {
    expect(() => validateManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      transport: ManagedServiceTransports.http,
      healthCheckPath: "health",
      args: [],
      environmentVariables: {},
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.never,
      startupTimeoutMs: 20_000,
      tags: [],
      capabilities: [],
    })).toThrow("healthCheckPath");

    expect(() => validateManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      transport: ManagedServiceTransports.http,
      args: [],
      environmentVariables: {},
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.never,
      startupTimeoutMs: 0,
      tags: [],
      capabilities: [],
    })).toThrow("startupTimeoutMs");
  });
});
