import { describe, expect, it } from "bun:test";
import { ExecutionPlan, ExecutionStatuses, ExecutionUnitKinds } from "../../../src/domain/execution/ExecutionPlan";
import { McpServerOperationExecutionUnitHandler } from "../McpServerOperationExecutionUnitHandler";

describe("McpServerOperationExecutionUnitHandler", () => {
  it("wraps MCP server connect operations with truthful engine-native summaries", async () => {
    const handler = new McpServerOperationExecutionUnitHandler({
      connectServer: async ({ serverId }) => ({
        action: "connect" as const,
        checkedAt: "2026-03-23T00:00:00.000Z",
        server: {
          id: serverId,
          name: "Local MCP",
          transport: "stdio" as const,
          enabled: true,
          status: "connected" as const,
          connected: true,
          toolCount: 2,
          resourceCount: 1,
          capabilities: { tools: true, resources: true, toolExecution: true },
        },
        status: {
          serverId,
          name: "Local MCP",
          transport: "stdio" as const,
          configured: true,
          enabled: true,
          state: "connected" as const,
          lifecycleState: "running" as const,
          sessionState: "connected" as const,
          connected: true,
          checkedAt: "2026-03-23T00:00:00.000Z",
          toolCount: 2,
          resourceCount: 1,
          capabilities: { tools: true, resources: true, toolExecution: true },
        },
        runtime: {
          enabled: true,
          state: "ready" as const,
          healthState: "healthy" as const,
          checkedAt: "2026-03-23T00:00:00.000Z",
          servers: [],
          capabilities: { tools: true, resources: true, toolExecution: true },
        },
      }),
      disconnectServer: async () => {
        throw new Error("unused");
      },
      reconnectServer: async () => {
        throw new Error("unused");
      },
      createLocalServer: async () => {
        throw new Error("unused");
      },
    });
    const events: unknown[] = [];

    const result = await handler.execute(
      {
        plan: new ExecutionPlan({
          id: "mcp-server-operation:connect:local",
          units: [{ id: "mcp-server-operation:connect:local", kind: ExecutionUnitKinds.mcpServerOperation }],
        }),
        runId: "run-1",
        unit: { id: "mcp-server-operation:connect:local", kind: ExecutionUnitKinds.mcpServerOperation, dependsOn: [] },
        unitInputs: {
          "mcp-server-operation:connect:local": {
            action: "connect",
            serverId: "local",
          },
        },
      },
      (event) => events.push(event),
    );

    expect(events).toHaveLength(1);
    expect(result.status).toBe(ExecutionStatuses.completed);
    expect(result.outputSummary?.headline).toBe("MCP server connected");
    expect(result.outputMetadata?.runtimeState).toBe("ready");
    expect(result.outputMetadata?.sessionState).toBe("connected");
    expect(result.provenance?.classification).toBe("delegated");
    expect(result.artifacts?.[0]?.kind).toBe("mcp-server-operation-result");
  });
});
