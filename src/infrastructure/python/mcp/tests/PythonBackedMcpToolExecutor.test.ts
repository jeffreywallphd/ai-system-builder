import { describe, expect, it } from "bun:test";
import { RuntimeEventBuffer } from "@application/runtime/RuntimeEventBuffer";
import { PythonBackedMcpToolExecutor } from "../PythonBackedMcpToolExecutor";

describe("PythonBackedMcpToolExecutor", () => {
  it("executes tools and emits structured success events", async () => {
    const events = new RuntimeEventBuffer();
    const executor = new PythonBackedMcpToolExecutor(
      {
        getConnectionStatus: async () => ({
          enabled: true,
          state: "ready",
          checkedAt: "2026-03-19T00:00:00.000Z",
          capabilities: { tools: true },
          servers: [],
        }),
        listTools: async () => [],
        executeTool: async (request) => ({
          executionId: "exec-1",
          serverId: request.serverId,
          toolName: request.toolName,
          status: "completed",
          content: [{ type: "text", text: "ok" }],
        }),
      },
      { emit: (event) => events.append(event as never) }
    );

    const result = await executor.executeTool({ serverId: "server", toolName: "echo" });

    expect(result.executionId).toBe("exec-1");
    expect(events.list().map((event) => event.details?.eventType)).toEqual([
      "mcp-tool-execution-start",
      "mcp-tool-execution-success",
    ]);
  });

  it("fails fast when a sandbox denial is already present in trust metadata", async () => {
    const executor = new PythonBackedMcpToolExecutor({
      getConnectionStatus: async () => ({
        enabled: true,
        state: "ready",
        checkedAt: "2026-03-19T00:00:00.000Z",
        capabilities: { tools: true },
        servers: [],
      }),
      listTools: async () => [],
      executeTool: async () => {
        throw new Error("runtime should not execute when sandbox is denied");
      },
    });

    const result = await executor.executeTool({
      serverId: "server",
      toolName: "echo",
      metadata: {
        trust: {
          sandboxDecision: {
            allowed: false,
            deniedCapabilities: ["network"],
          },
        },
      },
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("Sandbox denied");
  });
});

