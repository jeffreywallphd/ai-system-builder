import { describe, expect, it } from "bun:test";
import { DeterministicToolCapabilityAgentOrchestrator } from "../DeterministicToolCapabilityAgentOrchestrator";
import type { IToolCapabilityExecutor } from "@application/ports/interfaces/IToolCapabilityExecutor";
import type { ToolCapabilityDescriptor } from "@application/tools/models/ToolCapabilityDescriptor";
import type { ToolCapabilityInvocationRequest } from "@application/tools/models/ToolCapabilityInvocationRequest";
import { ExecutionContextEnvelope } from "@application/context/models/ExecutionContextEnvelope";

function makeCapability(overrides: Partial<ToolCapabilityDescriptor> & Pick<ToolCapabilityDescriptor, "id">): ToolCapabilityDescriptor {
  return {
    id: overrides.id,
    identity: overrides.identity ?? { stableId: overrides.id, providerScopedId: overrides.id },
    routingName: overrides.routingName ?? overrides.displayName ?? overrides.id,
    displayName: overrides.displayName ?? overrides.id,
    description: overrides.description,
    provider: overrides.provider ?? { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
    source: overrides.source ?? { kind: "mcp", serverId: "local", toolName: overrides.id },
    publication: overrides.publication ?? { isPublished: true },
    inputSchema: overrides.inputSchema,
    outputSchema: overrides.outputSchema,
    annotations: overrides.annotations,
    metadata: overrides.metadata,
  };
}

describe("DeterministicToolCapabilityAgentOrchestrator", () => {
  it("executes bounded tool iterations through the unified capability executor", async () => {
    const invocations: ToolCapabilityInvocationRequest[] = [];
    const orchestrator = new DeterministicToolCapabilityAgentOrchestrator({
      async invoke(request) {
        invocations.push(request);
        return {
          capabilityId: request.capabilityId,
          executionId: `tool-${invocations.length}`,
          status: "completed",
          provider: request.provider,
          source: request.source,
          content: [{ type: "text", text: String(request.arguments?.input ?? "") }],
          structuredContent: { echoed: request.arguments?.input as string },
          metadata: request.metadata,
        };
      },
    } satisfies IToolCapabilityExecutor);

    const echoTool = makeCapability({ id: "mcp:local:echo", displayName: "Echo", routingName: "echo", description: "Echo text back to the user.", source: { kind: "mcp", serverId: "local", toolName: "echo" } });
    const searchTool = makeCapability({ id: "mcp:local:search_docs", displayName: "Search Docs", routingName: "search_docs", description: "Search project docs.", source: { kind: "mcp", serverId: "local", toolName: "search_docs" } });

    const executionContext = new ExecutionContextEnvelope({
      packageReferences: [{ packageId: "pkg-1", alias: "Policy" }],
      assembledContext: { fragments: [{ id: "ctx-1", kind: "instructions", content: "Use tools carefully.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }], sections: [{ kind: "instructions", title: "System Instructions", fragments: [{ id: "ctx-1", kind: "instructions", content: "Use tools carefully.", order: 0, assemblyKey: "instructions:ctx-1", precedence: 0, provenance: [] }], content: "Use tools carefully." }], promptText: "Use tools carefully." },
      inspection: { assembledPromptText: "Use tools carefully.", finalPromptText: "Use tools carefully.", finalFragmentIds: ["ctx-1"], entries: [] },
      toolUsePolicy: { instructions: "Use tools carefully." },
    });

    const result = await orchestrator.execute({
      executionId: "agent-123",
      input: "First search the docs, then echo the answer.",
      maxIterations: 2,
      availableTools: [searchTool, echoTool],
      selectedTools: [searchTool, echoTool],
      metadata: { workflowId: "wf-agent" },
      context: executionContext,
    });

    expect(invocations).toHaveLength(2);
    expect(invocations[0]?.capabilityId).toBe("mcp:local:search_docs");
    expect(invocations[1]?.capabilityId).toBe("mcp:local:echo");
    expect(result.iterationCount).toBe(2);
    expect(result.stoppedReason).toBe("max-iterations-reached");
    expect(result.steps[0]?.result?.structuredContent).toEqual({ echoed: "First search the docs" });
    expect(result.steps[1]?.provider.kind).toBe("mcp");
    expect(invocations[0]?.context?.inspection?.finalPromptText).toBe("Use tools carefully.");
    expect(invocations[0]?.metadata?.contextInstructions).toBe("Use tools carefully.");
  });

  it("stops with a structured failure when a tool invocation fails", async () => {
    const orchestrator = new DeterministicToolCapabilityAgentOrchestrator({
      async invoke(request) {
        return {
          capabilityId: request.capabilityId,
          executionId: "tool-failed",
          status: "failed",
          provider: request.provider,
          source: request.source,
          content: [],
          errorMessage: "boom",
        };
      },
    } satisfies IToolCapabilityExecutor);

    const tool = makeCapability({ id: "mcp:local:echo", displayName: "Echo", description: "Echo text back to the user.", source: { kind: "mcp", serverId: "local", toolName: "echo" } });
    const result = await orchestrator.execute({
      input: "Echo this",
      maxIterations: 1,
      availableTools: [tool],
      selectedTools: [tool],
    });

    expect(result.status).toBe("failed");
    expect(result.stoppedReason).toBe("tool-failed");
    expect(result.steps[0]?.errorMessage).toBe("boom");
  });
});

