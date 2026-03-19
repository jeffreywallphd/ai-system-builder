import { describe, expect, it } from "bun:test";
import { InMemoryWorkflowRepository } from "../../mocks/repositories/InMemoryWorkflowRepository";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { WorkflowToolProjectionService } from "../../../application/projection/WorkflowToolProjectionService";
import { WorkflowProjectedToolCapabilityCatalog } from "../WorkflowProjectedToolCapabilityCatalog";
import { McpToolCapabilityCatalog } from "../McpToolCapabilityCatalog";
import { CompositeToolCapabilityCatalog } from "../CompositeToolCapabilityCatalog";
import type { IMcpToolCatalog } from "../../../application/ports/interfaces/IMcpToolCatalog";
import { CompositeToolCapabilityExecutor } from "../CompositeToolCapabilityExecutor";
import type { IToolCapabilityExecutor } from "../../../application/ports/interfaces/IToolCapabilityExecutor";

describe("tool capability adapters", () => {
  it("lists workflow and MCP capabilities with source metadata preserved", async () => {
    const workflowRepository = new InMemoryWorkflowRepository();
    await workflowRepository.save(
      makeWorkflow({ id: "wf-image", nodes: [makeNode({ id: "n1" })] }).withMetadata(
        new WorkflowMetadata({
          name: "Image Creator",
          isPublishedAsTool: true,
          toolTitle: "Image Creator",
          toolDescription: "Generate images.",
          toolCategory: "media",
          toolSlug: "image-creator",
        })
      )
    );

    const mcpCatalog: IMcpToolCatalog = {
      async getConnectionStatus() {
        return {
          enabled: true,
          state: "ready" as const,
          checkedAt: "2026-03-19T00:00:00.000Z",
          capabilities: { tools: true },
          servers: [],
        };
      },
      async listTools() {
        return [
          {
            serverId: "local",
            name: "echo",
            title: "Echo",
            inputSchema: { type: "object", properties: { text: { type: "string" } } },
          },
        ];
      },
    };

    const catalog = new CompositeToolCapabilityCatalog([
      new WorkflowProjectedToolCapabilityCatalog(workflowRepository, new WorkflowToolProjectionService()),
      new McpToolCapabilityCatalog(mcpCatalog),
    ]);

    const capabilities = await catalog.listCapabilities();
    const workflowCapability = capabilities.find((capability) => capability.provider.kind === "workflow");
    const mcpCapability = capabilities.find((capability) => capability.provider.kind === "mcp");

    expect(workflowCapability?.id).toBe("workflow:wf-image");
    expect(workflowCapability?.publication.slug).toBe("image-creator");
    expect(workflowCapability?.source.workflowToolId).toBe("wf-image");
    expect(mcpCapability?.id).toBe("mcp:local:echo");
    expect(mcpCapability?.source.serverId).toBe("local");
    expect(mcpCapability?.source.toolName).toBe("echo");
  });

  it("routes invocations to the executor registered for the requested provider", async () => {
    const workflowExecutor: IToolCapabilityExecutor = {
      async invoke(request) {
        return {
          capabilityId: request.capabilityId,
          executionId: "wf-exec",
          status: "completed",
          provider: request.provider,
          source: request.source,
          content: [],
        };
      },
    };
    const mcpExecutor: IToolCapabilityExecutor = {
      async invoke(request) {
        return {
          capabilityId: request.capabilityId,
          executionId: "mcp-exec",
          status: "completed",
          provider: request.provider,
          source: request.source,
          content: [],
        };
      },
    };

    const composite = new CompositeToolCapabilityExecutor([
      {
        providerKind: "workflow",
        providerId: "workflow-projection",
        executor: workflowExecutor,
      },
      {
        providerKind: "mcp",
        providerId: "python-mcp-runtime",
        executor: mcpExecutor,
      },
    ]);

    const workflowResult = await composite.invoke({
      capabilityId: "workflow:wf-image",
      provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
    });
    const mcpResult = await composite.invoke({
      capabilityId: "mcp:local:echo",
      provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
    });

    expect(workflowResult.executionId).toBe("wf-exec");
    expect(mcpResult.executionId).toBe("mcp-exec");
  });
});
