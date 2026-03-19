import { describe, expect, it, mock } from "bun:test";
import { InvokeToolCapabilityUseCase } from "../InvokeToolCapabilityUseCase";
import type { IToolCapabilityExecutor } from "../../ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "../models/ToolCapabilityInvocationRequest";

describe("InvokeToolCapabilityUseCase", () => {
  it("routes invocations to the configured executor with normalized provider metadata", async () => {
    const invoke = mock(async (request: ToolCapabilityInvocationRequest) =>
      Object.freeze({
        capabilityId: request.capabilityId,
        executionId: "exec-1",
        status: "completed" as const,
        provider: request.provider,
        source: request.source,
        content: Object.freeze([Object.freeze({ ok: true })]),
      })
    );
    const executor: IToolCapabilityExecutor = { invoke };

    const result = await new InvokeToolCapabilityUseCase(executor).execute({
      capabilityId: " workflow:wf-image ",
      provider: { kind: "workflow", id: " workflow-projection ", label: " Workflow Tools " },
      source: { kind: "workflow", workflowId: " wf-image ", workflowToolId: " wf-image " },
      arguments: { prompt: "hello", nested: { tone: "friendly" } },
      metadata: { origin: "test" },
    });

    expect(invoke).toHaveBeenCalledWith({
      capabilityId: "workflow:wf-image",
      provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
      source: { kind: "workflow", workflowId: "wf-image", workflowToolId: "wf-image" },
      arguments: { prompt: "hello", nested: { tone: "friendly" } },
      executionId: undefined,
      metadata: { origin: "test" },
    });
    expect(result.executionId).toBe("exec-1");
  });

  it("rejects invocations missing capability or provider identity", async () => {
    const executor: IToolCapabilityExecutor = {
      async invoke() {
        throw new Error("should not execute");
      },
    };

    await expect(
      new InvokeToolCapabilityUseCase(executor).execute({
        capabilityId: " ",
        provider: { kind: "local", id: "local-runtime", label: "Local Tools" },
      })
    ).rejects.toThrow("Tool capability invocation requires a capabilityId.");

    await expect(
      new InvokeToolCapabilityUseCase(executor).execute({
        capabilityId: "local:asset-inspector",
        provider: { kind: "local", id: " ", label: "Local Tools" },
      })
    ).rejects.toThrow("Tool capability invocation requires a provider.id.");
  });

  it("rejects invocations whose source kind conflicts with the provider", async () => {
    const executor: IToolCapabilityExecutor = {
      async invoke() {
        throw new Error("should not execute");
      },
    };

    await expect(
      new InvokeToolCapabilityUseCase(executor).execute({
        capabilityId: "mcp:local:echo",
        provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
        source: { kind: "workflow", serverId: "local", toolName: "echo" },
      })
    ).rejects.toThrow("Tool capability invocation source.kind must match provider.kind.");
  });
});
