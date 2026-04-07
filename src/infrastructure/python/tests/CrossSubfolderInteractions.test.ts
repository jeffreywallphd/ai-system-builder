import { describe, expect, it } from "bun:test";
import { PythonRuntimeConfig } from "../../config/PythonRuntimeConfig";
import { PythonRuntimeRegistry } from "../runtime/PythonRuntimeRegistry";
import { PythonRuntimeHealthMonitor } from "../runtime/PythonRuntimeHealthMonitor";

describe("python cross-subfolder interactions", () => {
  it("composes runtime registry with health monitor", async () => {
    const client = {
      health: async () => ({ status: "ok" as const, runtime: "python" as const }),
      executeNode: async () => ({ executionId: "e", nodeId: "n", status: "completed" as const, outputs: {} }),
      executeWorkflow: async () => ({ executionId: "e", workflowId: "wf", status: "completed" as const, nodeResults: {} }),
    };

    const registry = new PythonRuntimeRegistry({ config: new PythonRuntimeConfig({ mode: "local-http", baseUrl: "http://local" }), client });
    const monitor = new PythonRuntimeHealthMonitor(registry.getClient()!);

    expect(registry.isEnabled()).toBe(true);
    expect(await monitor.isHealthy()).toBe(true);
  });
});
