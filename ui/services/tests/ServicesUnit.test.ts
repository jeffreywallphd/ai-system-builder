import { describe, expect, it, mock } from "bun:test";
import { NodeService } from "../NodeService";
import { ModelService } from "../ModelService";
import { WorkflowService } from "../WorkflowService";
import { CanonicalAssetManagementService } from "../CanonicalAssetManagementService";

describe("ui/services unit coverage", () => {
  it("NodeService trims ids before delegating lookups", async () => {
    const getDefinitionById = mock(async (id: string) => ({ id }) as any);
    const service = new NodeService({
      createNodeUseCase: { execute: async () => ({}) } as any,
      connectNodesUseCase: { execute: () => ({}) } as any,
      listAvailableNodesUseCase: { execute: async () => ({ definitions: [] }) } as any,
      nodeCatalogProvider: {
        getDefinitionById,
        getDefinitionByType: async () => undefined,
        getCategories: async () => [],
        listDefinitions: async () => [],
      } as any,
    });

    await service.getDefinitionById("  n1  ");
    expect(getDefinitionById).toHaveBeenCalledWith("n1");
  });

  it("ModelService returns frozen remote search result", async () => {
    const service = new ModelService({
      installModelUseCase: { execute: async () => ({}) } as any,
      listInstalledModelsUseCase: { execute: async () => ({ models: [] }) } as any,
      removeModelUseCase: { execute: async () => ({}) } as any,
      resolveModelCompatibilityUseCase: { execute: () => ({ compatibility: { ok: true } }) } as any,
      searchRemoteModelsUseCase: {
        execute: async () => ({ items: [{ remoteId: "r1", model: { id: "m1" } }], nextCursor: "c1" }),
      } as any,
      installedModelCatalog: {
        getInstalledById: async () => undefined,
        isInstalled: async () => false,
        listInstalled: async () => [],
        saveInstalled: async (m: any) => m,
        removeInstalled: async () => false,
      } as any,
    });

    const result = await service.searchRemoteModels();
    expect(Object.isFrozen(result)).toBeTrue();
    expect(result.nextCursor).toBe("c1");
  });

  it("WorkflowService appends error message to execution messages", () => {
    const service = new WorkflowService({
      createWorkflowUseCase: { execute: async () => ({}) } as any,
      executeWorkflowUseCase: { execute: async () => ({}) } as any,
      validateWorkflowUseCase: { execute: () => ({ validation: { isValid: true } }) } as any,
      workflowRepository: {
        save: async () => undefined,
        load: async () => undefined,
        list: async () => [],
        delete: async () => true,
      },
    });

    expect(
      service.extractExecutionMessages({ messages: ["ok"], errorMessage: "bad" } as any)
    ).toEqual(["ok", "bad"]);
  });

  it("WorkflowService lists workflow read models through canonical-aware load path", async () => {
    const service = new WorkflowService({
      createWorkflowUseCase: { execute: async () => ({}) } as any,
      executeWorkflowUseCase: { execute: async () => ({}) } as any,
      validateWorkflowUseCase: { execute: () => ({ validation: { isValid: true } }) } as any,
      workflowRepository: {
        save: async () => undefined,
        load: async () => ({ id: "w1" }),
        list: async () => [{ id: "w1", name: "workflow", updatedAt: new Date() }],
        delete: async () => true,
      } as any,
      loadWorkflowUseCase: {
        execute: async () => ({ workflow: { id: "w1" }, canonicalRead: { preferred: true, assetId: "workflow-definition:w1" } }),
      } as any,
    });
    const items = await service.listWorkflowReadModels();
    expect(items[0]?.canonicalRead?.assetId).toBe("workflow-definition:w1");
  });

  it("CanonicalAssetManagementService returns bounded fallback when operations are not configured", async () => {
    const service = new CanonicalAssetManagementService();
    expect(await service.listAssets()).toEqual([]);
    const replay = await service.replayScopedProjection({ entityType: "workflow-definition", entityId: "wf-1" });
    expect(replay.replayed).toBeFalse();
  });
});
