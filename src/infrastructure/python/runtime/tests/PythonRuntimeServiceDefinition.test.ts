import { describe, expect, it } from "bun:test";
import { ManagedServiceStartPolicies } from "@application/services/interfaces/ManagedServiceTypes";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import {
  PYTHON_RUNTIME_MANAGED_SERVICE_ID,
  createPythonRuntimeServiceDefinition,
} from "../PythonRuntimeServiceDefinition";

describe("createPythonRuntimeServiceDefinition", () => {
  it("registers the built-in python runtime using the current folder and health endpoint conventions", () => {
    const definition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({
      mode: "local-http",
      baseUrl: "http://127.0.0.1:8000",
      pythonExecutable: "python3",
      pythonVersion: "3.11",
      runtimeWorkingDirectory: "/workspace/ai-loom-studio/python-runtime",
      startupTimeoutMs: 45_000,
      autoStartEnabled: true,
    }));

    expect(definition.serviceId).toBe(PYTHON_RUNTIME_MANAGED_SERVICE_ID);
    expect(definition.baseUrl).toBe("http://127.0.0.1:8000");
    expect(definition.healthCheckPath).toBe("/health");
    expect(definition.workingDirectory).toBe("/workspace/ai-loom-studio/python-runtime");
    expect(definition.command).toBe("python3");
    expect(definition.pythonVersion).toBe("3.11");
    expect(definition.args).toEqual([
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
    ]);
    expect(definition.autoStartPolicy).toBe(ManagedServiceStartPolicies.onDemand);
    expect(definition.capabilities).toContain("mcp-runtime");
  });

  it("marks disabled configs as disabled without removing the definition", () => {
    const definition = createPythonRuntimeServiceDefinition(new PythonRuntimeConfig({ mode: "disabled" }));

    expect(definition.serviceId).toBe(PYTHON_RUNTIME_MANAGED_SERVICE_ID);
    expect(definition.autoStartPolicy).toBe(ManagedServiceStartPolicies.disabled);
    expect(definition.healthCheckPath).toBe("/health");
  });
});

