import { describe, expect, it, mock } from "bun:test";
import { InvokeToolCapabilityUseCase } from "../InvokeToolCapabilityUseCase";
import type { IToolCapabilityExecutor } from "../../ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityInvocationRequest } from "../models/ToolCapabilityInvocationRequest";
import { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";

const executionContext = new ExecutionContextEnvelope({
  packageReferences: [{ packageId: "pkg-style", alias: "Style" }],
  assembledContext: {
    fragments: [{ id: "f-1", kind: "persona", content: "Stay concise.", order: 0, assemblyKey: "persona:f-1", precedence: 0, provenance: [] }],
    sections: [{ kind: "persona", title: "Persona", fragments: [{ id: "f-1", kind: "persona", content: "Stay concise.", order: 0, assemblyKey: "persona:f-1", precedence: 0, provenance: [] }], content: "Stay concise." }],
    promptText: "Persona:\nStay concise.",
  },
  inspection: {
    assembledPromptText: "Persona:\nStay concise.",
    finalPromptText: "Persona:\nStay concise.",
    finalFragmentIds: ["f-1"],
    entries: [],
  },
  toolUsePolicy: {
    instructions: "Prefer concise tool calls.",
    allowedProviderKinds: ["workflow"],
  },
});

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
      context: executionContext,
    });

    expect(invoke).toHaveBeenCalledWith({
      capabilityId: "workflow:wf-image",
      provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
      source: { kind: "workflow", workflowId: "wf-image", workflowToolId: "wf-image" },
      context: executionContext,
      arguments: { prompt: "hello", nested: { tone: "friendly" } },
      executionId: undefined,
      metadata: {
        origin: "test",
        workflowContext: {
          packageReferences: executionContext.packageReferences,
          assembledContext: executionContext.assembledContext,
          trimmingPolicy: executionContext.trimmingPolicy,
          budget: executionContext.budget,
          inspection: executionContext.inspection,
          toolUsePolicy: executionContext.toolUsePolicy,
        },
      },
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

  it("blocks invocations that violate context tool-use policy", async () => {
    const executor: IToolCapabilityExecutor = {
      async invoke() {
        throw new Error("should not execute");
      },
    };

    await expect(
      new InvokeToolCapabilityUseCase(executor).execute({
        capabilityId: "mcp:local:echo",
        provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
        source: { kind: "mcp", serverId: "local", toolName: "echo" },
        context: executionContext,
      })
    ).rejects.toThrow("Execution context policy blocked the requested MCP tool invocation.");
  });
});
