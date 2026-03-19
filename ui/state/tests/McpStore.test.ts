import { describe, expect, it } from "bun:test";
import { McpStore } from "../McpStore";
import { McpService } from "../../services/McpService";

describe("McpStore", () => {
  it("loads MCP availability and discovered tools", async () => {
    const store = new McpStore(
      new McpService({
        execute: async () => ({
          status: {
            enabled: true,
            state: "ready",
            checkedAt: new Date().toISOString(),
            servers: [{ id: "local", name: "Local MCP", transport: "inmemory", status: "connected", toolCount: 2, resourceCount: 0, capabilities: { tools: true } }],
            capabilities: { tools: true, resources: false, toolExecution: true },
          },
          tools: [
            { serverId: "local", name: "echo", inputSchema: { type: "object" } },
            { serverId: "local", name: "sum_numbers", inputSchema: { type: "object" } },
          ],
        }),
      } as any),
    );

    await store.refresh();

    expect(store.getState().status?.state).toBe("ready");
    expect(store.getState().tools).toHaveLength(2);
    expect(store.getState().tools[0]?.name).toBe("echo");
  });

  it("captures MCP loading failures", async () => {
    const store = new McpStore(
      new McpService({
        execute: async () => {
          throw new Error("runtime offline");
        },
      } as any),
    );

    await expect(store.refresh()).rejects.toThrow("runtime offline");
    expect(store.getState().error).toBe("runtime offline");
  });
});
