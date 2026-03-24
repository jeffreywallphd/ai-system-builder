import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Workflow } from "../../../domain/workflows/Workflow";
import { WorkflowMetadata } from "../../../domain/workflows/WorkflowMetadata";
import { makeNode } from "../../../domain/workflows/tests/testUtils";
import { McpToolCallNodeConfigurationService } from "../../../application/mcp/McpToolCallNodeConfigurationService";
import { ImplementationRegistryNodeCatalogProvider } from "../../nodes/ImplementationRegistryNodeCatalogProvider";
import { McpNodeImplementationRegistry } from "../../nodes/mcp/McpNodeImplementationRegistry";
import { LocalFileStorage } from "../LocalFileStorage";
import { LocalWorkflowRepository } from "../LocalWorkflowRepository";

describe("LocalWorkflowRepository", () => {
  it("saves, loads, exists and lists workflows", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-workflows-"));
    try {
      const node = makeNode({ id: "n1" });
      const wf = new Workflow({ id: "wf-1", metadata: new WorkflowMetadata({ name: "WF" }), nodes: [node] });
      const repo = new LocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
        nodeCatalogProvider: {
          getAllDefinitions: async () => [node.definition],
          searchDefinitions: async () => [node.definition],
          getDefinitionById: async () => node.definition,
          getDefinitionByType: async () => node.definition,
          getCategories: async () => ["utility"],
        },
      });

      await repo.save(wf);
      expect(await repo.exists("wf-1")).toBe(true);
      expect((await repo.load("wf-1"))?.id).toBe("wf-1");
      expect((await repo.list()).length).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists workflow context recipe and package bindings with ordering and fragment filters", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-workflows-"));
    try {
      const node = makeNode({ id: "n1" });
      const wf = new Workflow({
        id: "wf-context",
        metadata: new WorkflowMetadata({
          name: "WF Context",
          contextConfiguration: {
            recipeSelections: [
              {
                recipeId: "company-default",
                alias: "Company default",
                isEnabled: true,
                surfaceInTool: true,
              },
              {
                recipeId: "internal-research",
                alias: "Internal research",
                isEnabled: false,
                surfaceInTool: false,
              },
            ],
            selectedRecipeIds: ["internal-research", "company-default"],
            packageReferences: [
              {
                packageId: "pkg-style",
                alias: "Style guide",
                includeFragmentIds: ["tone", "examples"],
                excludeFragmentIds: ["legacy"],
                isEnabled: true,
              },
              {
                packageId: "pkg-faq",
                alias: "FAQ",
                isEnabled: false,
              },
            ],
            selectedPackageIds: ["pkg-faq", "pkg-style"],
            visibilityMode: "basic",
            maxTokens: 500,
            trimPartialFragments: false,
          },
        }),
        nodes: [node],
      });
      const repo = new LocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
        nodeCatalogProvider: {
          getAllDefinitions: async () => [node.definition],
          searchDefinitions: async () => [node.definition],
          getDefinitionById: async () => node.definition,
          getDefinitionByType: async () => node.definition,
          getCategories: async () => ["utility"],
        },
      });

      await repo.save(wf);
      const loaded = await repo.load("wf-context");

      expect(loaded?.metadata.contextConfiguration).toEqual({
        recipeSelections: [
          {
            recipeId: "company-default",
            alias: "Company default",
            isEnabled: true,
            surfaceInTool: true,
          },
          {
            recipeId: "internal-research",
            alias: "Internal research",
            isEnabled: false,
            surfaceInTool: false,
          },
        ],
        selectedRecipeIds: ["company-default"],
        packageReferences: [
          {
            packageId: "pkg-style",
            alias: "Style guide",
            version: undefined,
            includeFragmentIds: ["tone", "examples"],
            excludeFragmentIds: ["legacy"],
            isEnabled: true,
          },
          {
            packageId: "pkg-faq",
            alias: "FAQ",
            version: undefined,
            includeFragmentIds: undefined,
            excludeFragmentIds: undefined,
            isEnabled: false,
          },
        ],
        selectedPackageIds: ["pkg-style"],
        visibilityMode: "basic",
        maxCharacters: undefined,
        maxTokens: 500,
        trimPartialFragments: false,
        includeKinds: undefined,
        excludeKinds: undefined,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists and restores MCP tool call nodes with stable tool identity and configured arguments", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "loom-workflows-"));
    try {
      const nodeCatalogProvider = new ImplementationRegistryNodeCatalogProvider(
        new McpNodeImplementationRegistry(),
      );
      const definition = await nodeCatalogProvider.getDefinitionByType("mcp.tool_call");
      if (!definition) {
        throw new Error("Expected mcp.tool_call definition.");
      }

      const configurationService = new McpToolCallNodeConfigurationService();
      let mcpNode = definition.createInstance("mcp-1")
        .withPropertyValue("serverId", "local")
        .withPropertyValue("toolName", "echo")
        .withPropertyValue("toolId", "mcp:local:echo")
        .withPropertyValue("toolDescriptor", {
          id: "mcp:local:echo",
          serverId: "local",
          name: "echo",
          inputSchema: { type: "object" },
          arguments: [{ name: "message", type: "string", required: true }],
          categories: [],
          tags: [],
        });
      mcpNode = configurationService.configureNode(mcpNode)
        .withPropertyValue(configurationService.argumentPropertyId("message"), "hello");

      const wf = new Workflow({
        id: "wf-mcp",
        metadata: new WorkflowMetadata({ name: "WF MCP" }),
        nodes: [mcpNode],
      });
      const repo = new LocalWorkflowRepository({
        fileStorage: new LocalFileStorage(),
        rootDirectory: root,
        nodeCatalogProvider,
      });

      await repo.save(wf);
      const loaded = await repo.load("wf-mcp");
      const loadedNode = loaded?.getNode("mcp-1");

      expect(loadedNode?.definition.type).toBe("mcp.tool_call");
      expect(loadedNode?.getProperty("toolId")?.value).toBe("mcp:local:echo");
      expect(loadedNode?.getProperty(configurationService.argumentPropertyId("message"))?.value).toBe("hello");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
