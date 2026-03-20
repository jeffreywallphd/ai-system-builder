import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";
import { DisabledPythonRuntimeManager } from "../../../infrastructure/python/runtime/DisabledPythonRuntimeManager";
import { ExternalHttpPythonRuntimeManager } from "../../../infrastructure/python/runtime/ExternalHttpPythonRuntimeManager";
import { ManagedLocalPythonRuntimeManager } from "../../../infrastructure/python/runtime/ManagedLocalPythonRuntimeManager";
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
    expect(dependencies.pythonRuntimeManager).toBeDefined();
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
    expect(nodeTypeIds).toContain("mcp.server_select");
    expect(nodeTypeIds).toContain("mcp.tool_catalog");
    expect(nodeTypeIds).toContain("mcp.tool_call");
  });

  it("selects the external HTTP runtime manager when configured", () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
      settingsStorage: {
        load: () => ({
          runtime: {
            mode: "external-http",
            baseUrl: "http://127.0.0.1:8000",
          },
        }),
        save: () => undefined,
      },
    });

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(ExternalHttpPythonRuntimeManager);
  });

  it("selects the managed-local runtime manager when configured", () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
      settingsStorage: {
        load: () => ({
          runtime: {
            mode: "managed-local",
            baseUrl: "http://127.0.0.1:8000",
          },
        }),
        save: () => undefined,
      },
    });

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(ManagedLocalPythonRuntimeManager);
  });

  it("selects the disabled runtime manager when configured", () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
      settingsStorage: {
        load: () => ({
          runtime: {
            mode: "disabled",
          },
        }),
        save: () => undefined,
      },
    });

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(DisabledPythonRuntimeManager);
  });

  it("keeps runtime console initialization safe when the runtime is unavailable", async () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
      settingsStorage: {
        load: () => ({
          runtime: {
            mode: "external-http",
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
