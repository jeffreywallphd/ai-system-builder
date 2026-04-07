import { describe, expect, it } from "bun:test";
import { PythonRuntimeHealthMonitor } from "../PythonRuntimeHealthMonitor";

describe("PythonRuntimeHealthMonitor", () => {
  it("reports health", async () => {
    const monitor = new PythonRuntimeHealthMonitor({
      health: async () => ({ status: "ok", runtime: "python" }),
      executeNode: async () => ({ executionId: "e", nodeId: "n", status: "completed", outputs: {} }),
      executeWorkflow: async () => ({ executionId: "e", workflowId: "wf", status: "completed", nodeResults: {} }),
    });

    expect(await monitor.isHealthy()).toBe(true);
  });
});
