import { describe, expect, it } from "bun:test";
import { PreviewAgentContextUseCase } from "../PreviewAgentContextUseCase";
import { WorkflowContextService } from "../WorkflowContextService";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";
import { makeWorkflow } from "../../../domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { ListToolCapabilitiesUseCase } from "../../tools/ListToolCapabilitiesUseCase";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import { buildToolCapabilityId, type ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";

function makeCatalog(capabilities: ReadonlyArray<ToolCapabilityDescriptor>): IToolCapabilityCatalog {
  return {
    async listCapabilities() {
      return capabilities;
    },
  };
}

describe("PreviewAgentContextUseCase", () => {
  it("shows agent capability reachability for workflow, local, and MCP tools", async () => {
    const workflow = makeWorkflow({ id: "wf-agent" }).withMetadata(
      new WorkflowMetadata({
        name: "Agent Workflow",
        contextConfiguration: {
          packageReferences: [{ packageId: "pkg-policy", alias: "Policy" }],
          selectedPackageIds: ["pkg-policy"],
        },
      })
    );
    const contextService = new WorkflowContextService(
      new InMemoryContextPackageRepository([
        new ContextPackage({
          id: "pkg-policy",
          name: "Policy",
          fragments: [{
            id: "policy",
            kind: "instructions",
            content: "Only use local MCP search_docs or workflow tools.",
            order: 0,
            metadata: {
              toolUsePolicy: {
                allowedProviderKinds: ["workflow", "mcp"],
                mcp: { allowedServerIds: ["local"], allowedToolNames: ["search_docs"] },
              },
            },
          }],
        }),
      ])
    );
    const capabilities: ToolCapabilityDescriptor[] = [
      {
        id: buildToolCapabilityId("workflow", "customer-tool"),
        identity: { stableId: "workflow:customer-tool", providerScopedId: "customer-tool" },
        routingName: "customer-tool",
        displayName: "Customer Tool",
        provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
        source: { kind: "workflow", workflowId: "wf-tool" },
        publication: { isPublished: true },
      },
      {
        id: buildToolCapabilityId("mcp", "local", "search_docs"),
        identity: { stableId: "mcp:local:search_docs", providerScopedId: "local:search_docs" },
        routingName: "search_docs",
        displayName: "Search Docs",
        provider: { kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" },
        source: { kind: "mcp", serverId: "local", toolName: "search_docs" },
        publication: { isPublished: false },
      },
      {
        id: buildToolCapabilityId("local", "asset-inspector"),
        identity: { stableId: "local:asset-inspector", providerScopedId: "asset-inspector" },
        routingName: "asset-inspector",
        displayName: "Asset Inspector",
        provider: { kind: "local", id: "local-runtime", label: "Local Tools" },
        source: { kind: "local", localToolName: "asset-inspector" },
        publication: { isPublished: false },
      },
    ];

    const result = await new PreviewAgentContextUseCase(
      contextService,
      new ListToolCapabilitiesUseCase(makeCatalog(capabilities)),
    ).execute({ workflow });

    expect(result.target.kind).toBe("agent");
    expect(result.capabilityDecisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: "workflow:customer-tool", status: "allowed" }),
      expect.objectContaining({ capabilityId: "mcp:local:search_docs", status: "allowed" }),
      expect.objectContaining({ capabilityId: "local:asset-inspector", status: "blocked" }),
    ]));
    expect(result.deliveryTargets.map((target) => target.channel)).toContain("mcp-capabilities");
  });
});
