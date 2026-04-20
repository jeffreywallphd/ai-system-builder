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
          capabilities: ["prepare-training-dataset"],
        }), { status: 200 });
      }

      expect(url.endsWith("/tasks/execute")).toBe(true);
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "content-type": "application/json" });
      return new Response(JSON.stringify({
        requestId: "req-python-1",
        taskType: "prepare-training-dataset",
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
      taskType: "prepare-training-dataset",
      payload: {},
    });

    expect(health.healthy).toBe(true);
    expect(capabilities.capabilities).toContain("prepare-training-dataset");
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

  it("enforces task timeout and forwards timeoutMs to runtime", async () => {
    const fetchImplementation = testDouble.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.timeoutMs).toBe(20);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
      return new Response(JSON.stringify({
        requestId: "req-python-2",
        taskType: "prepare-training-dataset",
        success: true,
        data: {},
      }), { status: 200 });
    });

    const client = createPythonRuntimeHttpClient({
      baseUrl: "http://127.0.0.1:43111",
      fetchImplementation,
      defaultTaskTimeoutMs: 20,
    });

    await expect(client.executeTask({
      requestId: "req-python-2",
      taskType: "prepare-training-dataset",
      payload: {},
    })).rejects.toThrow("timed out");
  });
});
