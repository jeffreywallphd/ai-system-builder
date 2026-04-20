import { describe, expect, it, testDouble } from "../../../../testing/node-test";

import { createPythonRuntimeHttpClient } from "../client/createPythonRuntimeHttpClient";

describe("createPythonRuntimeHttpClient", () => {
  it("supports health, capabilities, and task execution over local HTTP", async () => {
    const fetchImplementation = testDouble.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        expect(init?.method).toBe("GET");
        return new Response(JSON.stringify({
          healthy: true,
          status: {
            runtimeId: "python-sidecar",
            status: "ready",
          },
        }), { status: 200 });
      }

      if (url.endsWith("/capabilities")) {
        expect(init?.method).toBe("GET");
        return new Response(JSON.stringify({
          runtimeId: "python-sidecar",
          capabilities: ["prepare-templated-dataset"],
        }), { status: 200 });
      }

      expect(url.endsWith("/tasks/execute")).toBe(true);
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "content-type": "application/json" });
      return new Response(JSON.stringify({
        requestId: "req-python-1",
        taskType: "prepare-templated-dataset",
        success: false,
        error: {
          code: "not_implemented",
          message: "Not implemented",
        },
      }), { status: 200 });
    });

    const client = createPythonRuntimeHttpClient({
      baseUrl: "http://127.0.0.1:43111/",
      fetchImplementation,
    });

    const health = await client.getHealthStatus();
    const capabilities = await client.getCapabilities();
    const task = await client.executeTask({
      requestId: "req-python-1",
      taskType: "prepare-templated-dataset",
      payload: {},
    });

    expect(health.healthy).toBe(true);
    expect(capabilities.capabilities).toContain("prepare-templated-dataset");
    expect(task.success).toBe(false);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });

  it("throws on non-OK HTTP status", async () => {
    const fetchImplementation = testDouble.fn<typeof fetch>(async () =>
      new Response("{}", { status: 503 }));

    const client = createPythonRuntimeHttpClient({
      baseUrl: "http://127.0.0.1:43111",
      fetchImplementation,
    });

    await expect(client.getHealthStatus()).rejects.toThrow("status 503");
  });
});
