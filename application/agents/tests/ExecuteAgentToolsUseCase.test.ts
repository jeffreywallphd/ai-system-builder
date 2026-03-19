import { describe, expect, it } from "bun:test";
import { ExecuteAgentToolsUseCase } from "../ExecuteAgentToolsUseCase";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type {
  AgentToolOrchestrationRequest,
  IAgentToolOrchestrator,
} from "../../ports/interfaces/IAgentToolOrchestrator";
import type { ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";
import type { AgentExecutionResult } from "../models/AgentExecutionResult";

function makeCapability(overrides: Partial<ToolCapabilityDescriptor> & Pick<ToolCapabilityDescriptor, "id">): ToolCapabilityDescriptor {
  return {
    id: overrides.id,
    identity: overrides.identity ?? { stableId: overrides.id, providerScopedId: overrides.id },
    routingName: overrides.routingName ?? overrides.displayName ?? overrides.id,
    displayName: overrides.displayName ?? overrides.id,
    description: overrides.description,
    provider: overrides.provider ?? { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
    source: overrides.source ?? { kind: "workflow" },
    publication: overrides.publication ?? { isPublished: true },
    inputSchema: overrides.inputSchema,
    outputSchema: overrides.outputSchema,
    annotations: overrides.annotations,
    metadata: overrides.metadata,
  };
}

function makeCatalog(capabilities: ReadonlyArray<ToolCapabilityDescriptor>): IToolCapabilityCatalog {
  return {
    async listCapabilities() {
      return capabilities;
    },
  };
}

function makeExecutionResult(
  request: AgentToolOrchestrationRequest,
  overrides: Partial<AgentExecutionResult> = {}
): AgentExecutionResult {
  return {
    executionId: overrides.executionId ?? request.executionId ?? "agent-exec-1",
    status: overrides.status ?? "completed",
    input: overrides.input ?? request.input,
    maxIterations: overrides.maxIterations ?? request.maxIterations,
    iterationCount: overrides.iterationCount ?? overrides.steps?.length ?? 0,
    stoppedReason: overrides.stoppedReason ?? "completed",
    availableTools: overrides.availableTools ?? request.availableTools,
    selectedTools: overrides.selectedTools ?? request.selectedTools,
    steps: overrides.steps ?? [],
    finalOutput: overrides.finalOutput ?? "done",
    metadata: overrides.metadata,
    errorMessage: overrides.errorMessage,
  };
}

describe("ExecuteAgentToolsUseCase", () => {
  it("bounds max iterations before invoking the orchestrator", async () => {
    const captured: AgentToolOrchestrationRequest[] = [];
    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([makeCapability({ id: "workflow:tool-a" })]),
      {
        async execute(request) {
          captured.push(request);
          return makeExecutionResult(request);
        },
      } satisfies IAgentToolOrchestrator
    );

    const result = await useCase.execute({ input: "Run tool A", maxIterations: 99 });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.maxIterations).toBe(10);
    expect(result.maxIterations).toBe(10);
  });

  it("passes the selected tool set to the orchestrator and preserves provider/source metadata", async () => {
    const workflowTool = makeCapability({
      id: "workflow:generate-image",
      displayName: "Generate Image",
      routingName: "generate-image",
      provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
      source: { kind: "workflow", workflowId: "wf-image", workflowToolId: "wf-image", workflowToolSlug: "generate-image" },
    });
    const mcpTool = makeCapability({
      id: "mcp:local:echo",
      displayName: "Echo",
      routingName: "echo",
      provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
      source: { kind: "mcp", serverId: "local", toolName: "echo" },
    });

    let capturedRequest: AgentToolOrchestrationRequest | undefined;
    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([workflowTool, mcpTool]),
      {
        async execute(request) {
          capturedRequest = request;
          return makeExecutionResult(request);
        },
      } satisfies IAgentToolOrchestrator
    );

    await useCase.execute({
      input: "Use an MCP tool",
      toolSelection: { mode: "providerKinds", providerKinds: ["mcp"] },
    });

    expect(capturedRequest?.availableTools).toHaveLength(2);
    expect(capturedRequest?.selectedTools).toEqual([mcpTool]);
    expect(capturedRequest?.selectedTools[0]?.provider.kind).toBe("mcp");
    expect(capturedRequest?.selectedTools[0]?.source.serverId).toBe("local");
    expect(capturedRequest?.selectedTools[0]?.source.toolName).toBe("echo");
  });

  it("returns structured step results from the orchestrator", async () => {
    const capability = makeCapability({ id: "mcp:local:sum_numbers", provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" }, source: { kind: "mcp", serverId: "local", toolName: "sum_numbers" } });
    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([capability]),
      {
        async execute(request) {
          return makeExecutionResult(request, {
            iterationCount: 1,
            steps: [
              {
                stepIndex: 1,
                taskInput: "Add 2 and 3",
                capabilityId: capability.id,
                displayName: capability.displayName,
                provider: capability.provider,
                source: { kind: "mcp", serverId: "local", toolName: "sum_numbers" },
                status: "completed",
                reasoning: "The task asks for arithmetic.",
                invocationArguments: { numbers: [2, 3] },
                resultText: "5",
                result: {
                  capabilityId: capability.id,
                  executionId: "tool-exec-1",
                  status: "completed",
                  provider: capability.provider,
                  source: { kind: "mcp", serverId: "local", toolName: "sum_numbers" },
                  content: [{ type: "text", text: "5" }],
                  structuredContent: { total: 5 },
                },
              },
            ],
            finalOutput: "Computed 5.",
          });
        },
      } satisfies IAgentToolOrchestrator
    );

    const result = await useCase.execute({ input: "Add 2 and 3", maxIterations: 1 });

    expect(result.iterationCount).toBe(1);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.taskInput).toBe("Add 2 and 3");
    expect(result.steps[0]?.reasoning).toContain("arithmetic");
    expect(result.steps[0]?.result?.structuredContent).toEqual({ total: 5 });
    expect(result.finalOutput).toBe("Computed 5.");
  });

  it("supports source-aware filtering after explicit tool selection", async () => {
    const localEcho = makeCapability({
      id: "mcp:local:echo",
      displayName: "Local Echo",
      provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
      source: { kind: "mcp", serverId: "local", toolName: "echo" },
    });
    const remoteEcho = makeCapability({
      id: "mcp:remote:echo",
      displayName: "Remote Echo",
      provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
      source: { kind: "mcp", serverId: "remote", toolName: "echo" },
    });

    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([localEcho, remoteEcho]),
      {
        async execute(request) {
          return makeExecutionResult(request);
        },
      } satisfies IAgentToolOrchestrator
    );

    const result = await useCase.execute({
      input: "Only allow the local echo tool",
      toolSelection: {
        mode: "mixed",
        capabilityIds: ["mcp:local:echo", "mcp:remote:echo"],
        source: { kind: "mcp", serverId: "local" },
      },
    });

    expect(result.selectedTools).toEqual([localEcho]);
  });

  it("forwards assembled workflow context into orchestrator metadata", async () => {
    const capability = makeCapability({ id: "workflow:tool-a" });
    let capturedRequest: AgentToolOrchestrationRequest | undefined;
    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([capability]),
      {
        async execute(request) {
          capturedRequest = request;
          return makeExecutionResult(request);
        },
      } satisfies IAgentToolOrchestrator
    );

    await useCase.execute({
      input: "Use the workflow tool",
      context: {
        promptText: "Policy: stay concise.",
        selectedPackageIds: ["pkg-style"],
      },
    });

    expect((capturedRequest?.metadata?.workflowContext as { promptText?: string })?.promptText).toBe(
      "Policy: stay concise."
    );
  });

  it("rejects invalid provider-kind selection requests before orchestration", async () => {
    const useCase = new ExecuteAgentToolsUseCase(
      makeCatalog([makeCapability({ id: "workflow:tool-a" })]),
      {
        async execute(request) {
          return makeExecutionResult(request);
        },
      } satisfies IAgentToolOrchestrator
    );

    await expect(
      useCase.execute({
        input: "Run a provider-scoped agent task",
        toolSelection: { mode: "providerKinds", providerKinds: [] },
      })
    ).rejects.toThrow("requires at least one provider kind");
  });
});
