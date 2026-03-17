import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";
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
  });

  it("exposes registry-backed node definitions in the UI catalog", async () => {
    const dependencies = createUiDependencies({
      config: AppRuntimeConfig.forDevelopment(),
    });

    const definitions = await dependencies.nodeService.listAvailableNodes();
    const nodeTypeIds = definitions.map((definition) => definition.type);

    expect(nodeTypeIds).toContain("langchain.output-parser");
    expect(nodeTypeIds).toContain("langchain.context-merger");
  });
});
