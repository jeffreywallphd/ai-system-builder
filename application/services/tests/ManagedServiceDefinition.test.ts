import { describe, expect, it } from "bun:test";
import {
  createManagedServiceDefinition,
  ManagedServiceHealthProbeKinds,
  ManagedServiceRestartPolicies,
  ManagedServiceSources,
  ManagedServiceTransports,
  mergeBuiltinManagedServiceDefinition,
  validateManagedServiceDefinition,
} from "../ManagedServiceDefinition";
import { ManagedServiceKinds, ManagedServiceStartPolicies } from "../interfaces/ManagedServiceTypes";

describe("ManagedServiceDefinition", () => {
  it("normalizes a valid managed service definition and applies safe defaults", () => {
    const definition = createManagedServiceDefinition({
      serviceId: " python-runtime ",
      kind: ManagedServiceKinds.pythonRuntime,
      source: ManagedServiceSources.builtin,
      displayName: " Python runtime ",
      description: " Built-in runtime ",
      baseUrl: " http://127.0.0.1:8000 ",
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
    expect(definition.healthProbe).toEqual({ kind: ManagedServiceHealthProbeKinds.http, url: "http://127.0.0.1:8000/health" });
    expect(definition.args).toEqual(["-m", "uvicorn"]);
    expect(definition.environmentVariables).toEqual({ PYTHONUNBUFFERED: "1" });
    expect(definition.tags).toEqual(["builtin"]);
  });

  it("rejects invalid IDs, health check paths, env vars, and startup timeouts", () => {
    expect(() => validateManagedServiceDefinition({
      serviceId: "python runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      displayName: "Python runtime",
      transport: ManagedServiceTransports.http,
      args: [],
      environmentVariables: {},
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.never,
      startupTimeoutMs: 20_000,
      tags: [],
      capabilities: [],
    })).toThrow("lowercase letters");

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
      environmentVariables: { "NOT VALID": "1" },
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.never,
      startupTimeoutMs: 20_000,
      tags: [],
      capabilities: [],
    })).toThrow("shell-safe");

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

  it("keeps the built-in python runtime within protected safe boundaries", () => {
    const builtinDefinition = createManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      source: ManagedServiceSources.builtin,
      displayName: "Python runtime",
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:8000",
      command: "python",
      args: ["-m", "uvicorn"],
      autoStartPolicy: ManagedServiceStartPolicies.onDemand,
      restartPolicy: ManagedServiceRestartPolicies.onFailure,
      tags: ["builtin"],
      capabilities: ["workflow-execution"],
    });

    const updated = mergeBuiltinManagedServiceDefinition(builtinDefinition, createManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      source: ManagedServiceSources.builtin,
      displayName: "Python runtime (local)",
      transport: ManagedServiceTransports.http,
      baseUrl: "http://127.0.0.1:8100",
      command: "python3",
      autoStartPolicy: ManagedServiceStartPolicies.manual,
      restartPolicy: ManagedServiceRestartPolicies.always,
    }));

    expect(updated.displayName).toBe("Python runtime (local)");
    expect(updated.baseUrl).toBe("http://127.0.0.1:8100");
    expect(updated.command).toBe("python3");
    expect(updated.restartPolicy).toBe(ManagedServiceRestartPolicies.onFailure);
    expect(updated.args).toEqual(["-m", "uvicorn"]);

    expect(() => mergeBuiltinManagedServiceDefinition(builtinDefinition, createManagedServiceDefinition({
      serviceId: "python-runtime",
      kind: ManagedServiceKinds.pythonRuntime,
      source: ManagedServiceSources.builtin,
      displayName: "Python runtime",
      transport: ManagedServiceTransports.http,
      command: "node",
    }))).toThrow("python executables");
  });
});
