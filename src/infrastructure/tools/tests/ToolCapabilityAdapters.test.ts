import { describe, expect, it } from "bun:test";
import { InMemoryWorkflowRepository } from "../../mocks/repositories/InMemoryWorkflowRepository";
import { makeNode, makeWorkflow } from "../../../src/domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../src/domain/workflows/WorkflowMetadata";
import { WorkflowToolProjectionService } from "../../../application/projection/WorkflowToolProjectionService";
import { WorkflowProjectedToolCapabilityCatalog } from "../WorkflowProjectedToolCapabilityCatalog";
import { mapMcpToolToCapability, McpToolCapabilityCatalog } from "../McpToolCapabilityCatalog";
import { CompositeToolCapabilityCatalog } from "../CompositeToolCapabilityCatalog";
import type { IMcpToolCatalog } from "../../../application/ports/interfaces/IMcpToolCatalog";
import { CompositeToolCapabilityExecutor } from "../CompositeToolCapabilityExecutor";
import type { IToolCapabilityExecutor } from "../../../application/ports/interfaces/IToolCapabilityExecutor";
import { StaticLocalToolCapabilityCatalog } from "../StaticLocalToolCapabilityCatalog";

describe("tool capability adapters", () => {
  it("lists workflow, local, and MCP capabilities with source metadata preserved", async () => {
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
            id: "mcp:local:echo",
            serverId: "local",
            source: { kind: "mcp-server" as const, serverId: "local" },
            name: "echo",
            title: "Echo",
            arguments: [],
            categories: [],
            tags: [],
            inputSchema: { type: "object", properties: { text: { type: "string" } } },
          },
        ];
      },
    };

    const catalog = new CompositeToolCapabilityCatalog([
      new WorkflowProjectedToolCapabilityCatalog(workflowRepository, new WorkflowToolProjectionService()),
      new StaticLocalToolCapabilityCatalog([
        {
          id: "local:asset-inspector",
          displayName: "Asset Inspector",
          provider: { kind: "local", id: "local-runtime", label: "Local Tools" },
          source: { localToolName: "asset-inspector" },
          publication: { isPublished: false, title: "Asset Inspector" },
        },
      ]),
      new McpToolCapabilityCatalog(mcpCatalog),
    ]);

    const capabilities = await catalog.listCapabilities();
    const workflowCapability = capabilities.find((capability) => capability.provider.kind === "workflow");
    const localCapability = capabilities.find((capability) => capability.provider.kind === "local");
    const mcpCapability = capabilities.find((capability) => capability.provider.kind === "mcp");

    expect(workflowCapability?.id).toBe("workflow:wf-image");
    expect(workflowCapability?.publication.slug).toBe("image-creator");
    expect(workflowCapability?.routingName).toBe("image-creator");
    expect(workflowCapability?.source.workflowToolId).toBe("wf-image");
    expect(localCapability?.source.kind).toBe("local");
    expect(localCapability?.identity.providerScopedId).toBe("asset-inspector");
    expect(mcpCapability?.id).toBe("mcp:local:echo");
    expect(mcpCapability?.identity.stableId).toBe("mcp:local:echo");
    expect(mcpCapability?.source.serverId).toBe("local");
    expect(mcpCapability?.source.toolName).toBe("echo");
  });

  it("keeps MCP capability identity aligned with normalized MCP descriptor ids", () => {
    const capability = mapMcpToolToCapability({
      id: "mcp:docs%2Fprimary:search%20docs",
      serverId: "docs/primary",
      source: { kind: "mcp-server", serverId: "docs/primary" },
      name: "search docs",
      title: "Search Docs",
      description: "Search the primary docs server.",
      inputSchema: { type: "object" },
      arguments: [],
      categories: ["search"],
      tags: ["docs"],
    });

    expect(capability.id).toBe("mcp:docs%2Fprimary:search%20docs");
    expect(capability.identity.stableId).toBe("mcp:docs%2Fprimary:search%20docs");
    expect(capability.identity.providerScopedId).toBe("docs/primary:search docs");
    expect(capability.routingName).toBe("search docs");
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
      source: { kind: "workflow", workflowId: "wf-image", workflowToolId: "wf-image" },
    });
    const mcpResult = await composite.invoke({
      capabilityId: "mcp:local:echo",
      provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
      source: { kind: "mcp", serverId: "local", toolName: "echo" },
    });

    expect(workflowResult.executionId).toBe("wf-exec");
    expect(mcpResult.executionId).toBe("mcp-exec");
  });
});
