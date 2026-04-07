import { describe, expect, it } from "bun:test";
import { SearchCapabilitiesUseCase } from "../SearchCapabilitiesUseCase";
import type { McpResourceDescriptor } from "../../mcp/models/McpResourceDescriptor";
import type { IMcpToolCatalog } from "../../ports/interfaces/IMcpToolCatalog";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import type { ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";
import { buildToolCapabilityId } from "../../tools/models/ToolCapabilityDescriptor";

function makeCapability(
  overrides: Partial<ToolCapabilityDescriptor> & Pick<ToolCapabilityDescriptor, "id" | "displayName">
): ToolCapabilityDescriptor {
  return {
    id: overrides.id,
    identity: overrides.identity ?? { stableId: overrides.id, providerScopedId: overrides.id },
    routingName: overrides.routingName ?? overrides.displayName,
    displayName: overrides.displayName,
    description: overrides.description,
    provider: overrides.provider ?? { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
    source: overrides.source ?? { kind: "workflow" },
    publication: overrides.publication ?? { isPublished: false },
    inputSchema: overrides.inputSchema,
    outputSchema: overrides.outputSchema,
    annotations: overrides.annotations,
    metadata: overrides.metadata,
  };
}

describe("SearchCapabilitiesUseCase", () => {
  it("returns bounded multi-source capability candidates across unified tools, MCP servers, and MCP resources", async () => {
    const toolCatalog: IToolCapabilityCatalog = {
      async listCapabilities() {
        return [
          makeCapability({
            id: buildToolCapabilityId("workflow", "local-research-digest"),
            displayName: "Local Research Digest",
            description: "Compile local MCP notes into a research digest.",
            source: { kind: "workflow", workflowToolSlug: "local-research-digest" },
          }),
          makeCapability({
            id: buildToolCapabilityId("mcp", "local", "search_docs"),
            displayName: "Search Docs",
            description: "Search workspace and MCP-provided documents.",
            provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
            source: { kind: "mcp", serverId: "local", toolName: "search_docs" },
          }),
        ];
      },
    };

    const mcpCatalog: IMcpToolCatalog = {
      async getConnectionStatus() {
        return {
          enabled: true,
          state: "ready",
          checkedAt: "2026-03-19T00:00:00.000Z",
          servers: [],
          capabilities: { tools: true, resources: true, toolExecution: true },
        };
      },
      async listTools() {
        return [];
      },
      async listResources(): Promise<ReadonlyArray<McpResourceDescriptor>> {
        return [
          {
            serverId: "local",
            uri: "memory://docs/research-guide",
            name: "Research Guide",
            description: "Guide for local workspace research.",
          },
        ];
      },
    };

    const serverSearchCalls: unknown[] = [];
    const useCase = new SearchCapabilitiesUseCase(toolCatalog, {
      mcpToolCatalog: mcpCatalog,
      mcpRuntimeClient: {
        async searchServers(criteria) {
          serverSearchCalls.push(criteria);
          return {
            query: criteria?.query ?? "",
            totalCount: 1,
            limit: criteria?.limit ?? 8,
            servers: [
              {
                id: "local",
                name: "Local MCP",
                transport: "inmemory",
                status: "connected",
                toolCount: 2,
                resourceCount: 1,
                capabilities: { tools: true, resources: true, toolExecution: true },
              },
            ],
            status: {
              enabled: true,
              state: "ready",
              checkedAt: "2026-03-19T00:00:00.000Z",
              servers: [],
              capabilities: { tools: true, resources: true, toolExecution: true },
            },
          };
        },
      },
    });

    const result = await useCase.execute({ query: "local", limit: 5 });

    expect(serverSearchCalls).toEqual([{ query: "local", limit: 5 }]);
    expect(result.sources).toEqual({ toolCapabilities: 2, mcpServers: 1, mcpResources: 1 });
    expect(result.candidates.map((candidate) => candidate.kind)).toEqual([
      "tool-capability",
      "mcp-server",
      "tool-capability",
      "mcp-resource",
    ]);
    expect(result.candidates[0]?.title).toBe("Local Research Digest");
    expect(result.candidates[1]?.server?.id).toBe("local");
    expect(result.candidates[3]?.resource?.uri).toBe("memory://docs/research-guide");
  });

  it("supports MCP-assisted resource discovery without requiring general server search", async () => {
    const useCase = new SearchCapabilitiesUseCase(
      {
        async listCapabilities() {
          return [];
        },
      },
      {
        mcpToolCatalog: {
          async getConnectionStatus() {
            return {
              enabled: true,
              state: "ready",
              checkedAt: "2026-03-19T00:00:00.000Z",
              servers: [],
              capabilities: { tools: true, resources: true, toolExecution: true },
            };
          },
          async listTools() {
            return [];
          },
          async listResources() {
            return [
              {
                serverId: "docs",
                uri: "memory://docs/api-reference",
                title: "API Reference",
                mimeType: "text/markdown",
                description: "Reference for bounded discovery.",
              },
            ];
          },
        },
      }
    );

    const result = await useCase.execute({ query: "reference", includeMcpServers: false });

    expect(result.totalCandidateCount).toBe(1);
    expect(result.candidates[0]).toMatchObject({
      kind: "mcp-resource",
      title: "API Reference",
      subtitle: "docs",
    });
  });

  it("returns deterministic bounded results when many candidates tie on score", async () => {
    const useCase = new SearchCapabilitiesUseCase({
      async listCapabilities() {
        return [
          makeCapability({ id: buildToolCapabilityId("local", "zeta"), displayName: "Agent Notes", provider: { kind: "local", id: "local", label: "Local Tools" }, source: { kind: "local", localToolName: "zeta" } }),
          makeCapability({ id: buildToolCapabilityId("local", "alpha"), displayName: "Agent Notes", provider: { kind: "local", id: "local", label: "Local Tools" }, source: { kind: "local", localToolName: "alpha" } }),
          makeCapability({ id: buildToolCapabilityId("workflow", "beta"), displayName: "Agent Notes", source: { kind: "workflow", workflowToolSlug: "beta" } }),
        ];
      },
    });

    const result = await useCase.execute({ query: "agent notes", limit: 2 });

    expect(result.totalCandidateCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      "local:alpha",
      "local:zeta",
    ]);
  });
});
