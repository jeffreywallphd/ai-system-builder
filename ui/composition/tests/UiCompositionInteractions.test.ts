import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";
import { ManagedServicePythonRuntimeManagerAdapter } from "../../../application/services/adapters/ManagedServicePythonRuntimeManagerAdapter";
import { createUiDependencies } from "../createUiDependencies";

describe("ui composition interactions", () => {
  it("creates stores and services from runtime config", () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
    });

    expect(dependencies.config.workflowRepositoryMode).toBe("browser-storage");
    expect(dependencies.operationalStatus.workflowPersistence.effectiveMode).toBe("in-memory-fallback");
    expect(dependencies.operationalStatus.workflowPersistence.detail).toContain("Emergency fallback only");
    expect(dependencies.operationalStatus.nodeCatalog.effectiveMode).toBe("registered");
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
    expect(dependencies.executionHistoryService).toBeDefined();
    expect(dependencies.operationalStatus.modelLibrary.effectiveMode).toBe("browser-download-fallback");
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

  it("adapts the external HTTP runtime through the managed-service lifecycle", () => {
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

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
  });

  it("adapts the managed-local runtime through the managed-service lifecycle", () => {
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

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
  });

  it("adapts the disabled runtime through the managed-service lifecycle", () => {
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

    expect(dependencies.pythonRuntimeManager).toBeInstanceOf(ManagedServicePythonRuntimeManagerAdapter);
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

  it("seeds sample workflows into the active development repository fallback", async () => {
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
