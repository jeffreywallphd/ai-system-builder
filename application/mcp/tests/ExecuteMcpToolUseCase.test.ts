import { describe, expect, it } from "bun:test";
import { ExecuteMcpToolUseCase } from "../ExecuteMcpToolUseCase";
import type { IMcpToolExecutor } from "../../ports/interfaces/IMcpToolExecutor";

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
    });

    expect(result.status).toBe("completed");
    expect(requests).toEqual([
      {
        serverId: "local",
        toolName: "echo",
        arguments: { message: "hello" },
        metadata: undefined,
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
});
