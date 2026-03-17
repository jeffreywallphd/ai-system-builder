import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../../../config/PythonRuntimeConfig";
import { PythonRuntimeRegistry } from "../PythonRuntimeRegistry";

describe("PythonRuntimeRegistry", () => {
  it("tracks enabled state", () => {
    const registry = new PythonRuntimeRegistry({
      config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://localhost:8100" }),
      client: {
        health: async () => ({ status: "ok", runtime: "python" }),
        executeNode: async () => ({ executionId: "e", nodeId: "n", status: "completed", outputs: {} }),
        executeWorkflow: async () => ({ executionId: "e", workflowId: "wf", status: "completed", nodeResults: {} }),
      },
    });

    expect(registry.isEnabled()).toBe(true);
  });
});
