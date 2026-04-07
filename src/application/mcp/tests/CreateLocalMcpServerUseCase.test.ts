import { describe, expect, it } from "bun:test";
import { CreateLocalMcpServerUseCase } from "../CreateLocalMcpServerUseCase";
import { createUnifiedExecutionInfrastructure } from "@infrastructure/execution/createExecutionInfrastructure";
import type { IMcpServerManager } from "../../ports/interfaces/IMcpServerManager";

function buildServerResult(serverId: string) {
  return {
    checkedAt: "2026-03-24T00:00:00.000Z",
    server: {
      id: serverId,
      name: "Workspace Local Server",
      transport: "stdio" as const,
      enabled: true,
      command: "python",
      args: ["server.py"],
      status: "connected" as const,
      connected: true,
      toolCount: 1,
      resourceCount: 0,
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    status: {
      serverId,
      name: "Workspace Local Server",
      transport: "stdio" as const,
      configured: true,
      enabled: true,
      state: "connected" as const,
      connected: true,
      checkedAt: "2026-03-24T00:00:00.000Z",
      connectedAt: "2026-03-24T00:00:00.000Z",
      toolCount: 1,
      resourceCount: 0,
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    runtime: {
      enabled: true,
      state: "ready" as const,
      checkedAt: "2026-03-24T00:00:00.000Z",
      servers: [],
      capabilities: { tools: true, resources: false, toolExecution: true },
    },
    created: true,
  };
}

describe("CreateLocalMcpServerUseCase", () => {
  it("runs a dependency-aware create+connect execution plan when connectOnStartup is enabled", async () => {
    const calls: string[] = [];
    const savedRuns: unknown[] = [];
    const manager: IMcpServerManager = {
      connectServer: async ({ serverId }) => {
        calls.push(`connect:${serverId}`);
        return { action: "connect" as const, ...buildServerResult(serverId) };
      },
      disconnectServer: async (serverId) => ({ action: "disconnect" as const, ...buildServerResult(serverId) }),
      reconnectServer: async (serverId) => ({ action: "reconnect" as const, ...buildServerResult(serverId) }),
      createLocalServer: async (draft) => {
        calls.push(`create:${draft.serverId}`);
        return buildServerResult(draft.serverId);
      },
    };

    const executionEngine = createUnifiedExecutionInfrastructure({
      workflowExecutor: {
        canExecute: () => true,
        execute: async () => {
          throw new Error("workflow execution should not be used");
        },
        startExecution: async () => {
          throw new Error("workflow execution should not be used");
        },
      },
      mcpServerManager: manager,
      executionRunRepository: {
        saveRun: async (run) => {
          savedRuns.push(run);
          return run;
        },
        getRunById: async () => undefined,
        listRuns: async () => [],
      },
    });

    const result = await new CreateLocalMcpServerUseCase(manager, executionEngine).execute({
      draft: {
        serverId: " local-server ",
        serverName: " Local Server ",
        toolName: "tool",
        code: "def run(): pass",
        connectOnStartup: true,
      },
    });

    expect(result.server.id).toBe("local-server");
    expect(calls).toEqual(["create:local-server", "connect:local-server"]);
    const finalRun = savedRuns.at(-1) as {
      metadata?: Record<string, unknown>;
      units?: Record<string, { dependsOn?: ReadonlyArray<string>; status?: string }>;
    };
    expect(finalRun.metadata?.executionFlowId).toContain("mcp-provision-connect:local-server");
    expect(finalRun.metadata?.supportsMultiUnitComposition).toBe(true);
    expect(finalRun.units?.["mcp-server-operation:connect:local-server"]?.dependsOn).toEqual(["mcp-server-operation:create-local-server:local-server"]);
    expect(finalRun.units?.["mcp-server-operation:connect:local-server"]?.status).toBe("completed");
  });
});

