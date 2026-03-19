import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";
import { readSource } from "../../tests/testUtils";
import { createUiDependencies } from "../createUiDependencies";

describe("ui composition interactions", () => {
  it("creates stores and services from runtime config", () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
    });

    expect(dependencies.config.workflowRepositoryMode).toBe("memory");
    expect(dependencies.workflowStore).toBeDefined();
    expect(dependencies.nodeStore).toBeDefined();
    expect(dependencies.workflowService).toBeDefined();
    expect(dependencies.nodeService).toBeDefined();
    expect(dependencies.modelStore).toBeDefined();
    expect(dependencies.modelService).toBeDefined();
    expect(dependencies.runtimeConsoleStore).toBeDefined();
    expect(dependencies.mcpService).toBeDefined();
    expect(dependencies.mcpStore).toBeDefined();
    expect(dependencies.settingsStore).toBeDefined();
  });

  it("exposes registry-backed node definitions in the UI catalog", async () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
    });

    const definitions = await dependencies.nodeService.listAvailableNodes();
    const nodeTypeIds = definitions.map((definition) => definition.type);

    expect(nodeTypeIds).toContain("langchain.output_parser");
    expect(nodeTypeIds).toContain("langchain.document_loader");
    expect(nodeTypeIds).toContain("langchain.llm_chat");
    expect(nodeTypeIds).toContain("mcp.tool_catalog");
    expect(nodeTypeIds).toContain("mcp.tool_call");
  });


  it("uses the browser-safe runtime manager in UI composition", () => {
    const source = readSource("ui/composition/createUiDependencies.ts");

    expect(source).toContain("BrowserPythonRuntimeManager");
    expect(source).not.toContain("Node child process spawning is unavailable in browser composition.");
    expect(source).not.toContain("new PythonRuntimeProcessManager");
  });

  it("keeps runtime console initialization safe when the browser runtime is unavailable", async () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
      settingsStorage: {
        load: () => ({
          runtime: {
            mode: "local-http",
            baseUrl: "http://127.0.0.1:1",
          },
        }),
        save: () => undefined,
      },
    });

    await expect(dependencies.runtimeConsoleStore.initializeRuntime()).resolves.toBeUndefined();
    expect(dependencies.runtimeConsoleStore.getState().events.length).toBeGreaterThan(0);
  });

  it("seeds sample workflows with implemented nodes into the default in-memory repository", async () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
    });

    const workflows = await dependencies.workflowService.listWorkflows();
    const imageWorkflow = workflows.find((workflow) => workflow.id === "sample-image-pipeline");
    const textWorkflow = workflows.find((workflow) => workflow.id === "sample-text-analysis");
    const ragWorkflow = workflows.find((workflow) => workflow.id === "basic-rag-pipeline");

    expect(imageWorkflow).toBeDefined();
    expect(textWorkflow).toBeDefined();
    expect(ragWorkflow).toBeDefined();

    expect(imageWorkflow?.nodes.map((node) => node.definition.id)).toEqual([
      "langchain.prompt-template",
      "langchain.context-merger",
      "langchain.simple-chain",
      "langchain.output-parser",
    ]);
    expect(imageWorkflow?.connections).toHaveLength(4);

    expect(textWorkflow?.nodes.map((node) => node.definition.id)).toEqual([
      "shared.document-uploader",
      "langchain.document-to-chunks",
      "shared.chunk-displayer",
    ]);
    expect(textWorkflow?.connections).toHaveLength(2);

    expect(ragWorkflow?.nodes.map((node) => node.definition.id)).toEqual([
      "langchain.document_loader",
      "langchain.document_to_chunks",
      "langchain.embeddings",
      "langchain.vector_store_upsert",
      "langchain.similarity_search",
      "langchain.context_formatter",
      "langchain.llm_chat",
    ]);
    expect(ragWorkflow?.connections).toHaveLength(7);
  });
});
