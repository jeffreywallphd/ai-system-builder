import { describe, expect, it } from "bun:test";
import { ExecuteMcpToolUseCase } from "../ExecuteMcpToolUseCase";
import type { IMcpToolExecutor } from "../../ports/interfaces/IMcpToolExecutor";
import { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";

const executionContext = new ExecutionContextEnvelope({
  packageReferences: [{ packageId: "pkg-mcp", alias: "MCP policy" }],
  assembledContext: {
    fragments: [{ id: "ctx-1", kind: "instructions", content: "Only use the local MCP echo tool.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }],
    sections: [{ kind: "instructions", title: "System Instructions", fragments: [{ id: "ctx-1", kind: "instructions", content: "Only use the local MCP echo tool.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }], content: "Only use the local MCP echo tool." }],
    promptText: "Only use the local MCP echo tool.",
  },
  inspection: {
    assembledPromptText: "Only use the local MCP echo tool.",
    finalPromptText: "Only use the local MCP echo tool.",
    finalFragmentIds: ["ctx-1"],
    entries: [],
  },
  toolUsePolicy: {
    instructions: "Use the local echo MCP tool only.",
    allowedProviderKinds: ["mcp"],
    mcp: { allowedServerIds: ["local"], allowedToolNames: ["echo"] },
  },
});

describe("ExecuteMcpToolUseCase", () => {
  it("delegates a normalized tool execution request", async () => {
    const requests: unknown[] = [];
    const executor: IMcpToolExecutor = {
      executeTool: async (request) => {
        requests.push(request);
        return {
          executionId: "exec-1",
          serverId: request.serverId,
          toolName: request.toolName,
          status: "completed",
          content: [{ type: "text", text: "done" }],
        };
      },
    };

    const result = await new ExecuteMcpToolUseCase(executor).execute({
      serverId: " local ",
      toolName: " echo ",
      arguments: { message: "hello" },
      context: executionContext,
    });

    expect(result.status).toBe("completed");
    expect(requests).toEqual([
      {
        serverId: "local",
        toolName: "echo",
        arguments: { message: "hello" },
        context: executionContext,
        metadata: {
          workflowContext: {
            packageReferences: executionContext.packageReferences,
            assembledContext: executionContext.assembledContext,
            trimmingPolicy: executionContext.trimmingPolicy,
            budget: executionContext.budget,
            inspection: executionContext.inspection,
            toolUsePolicy: executionContext.toolUsePolicy,
          },
        },
      },
    ]);
  });

  it("rejects missing server identifiers", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };

    await expect(new ExecuteMcpToolUseCase(executor).execute({ serverId: " ", toolName: "echo" })).rejects.toThrow(
      "serverId"
    );
  });

  it("blocks MCP tools that violate execution context policy", async () => {
    const executor: IMcpToolExecutor = {
      executeTool: async () => {
        throw new Error("should not run");
      },
    };

    await expect(
      new ExecuteMcpToolUseCase(executor).execute({
        serverId: "remote",
        toolName: "echo",
        context: executionContext,
      })
    ).rejects.toThrow("Execution context policy blocked the requested MCP tool invocation.");
  });
});
