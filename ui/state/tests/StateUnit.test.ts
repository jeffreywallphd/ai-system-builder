import { describe, expect, it } from "bun:test";
import { NodeStore } from "../NodeStore";
import { ModelStore } from "../ModelStore";
import { WorkflowStore } from "../WorkflowStore";

describe("ui/state unit coverage", () => {
  it("NodeStore clears selection when selecting undefined", async () => {
    const store = new NodeStore({
      nodeService: {} as any,
      initialState: { selectedDefinitionId: "d1" },
    });
    await store.selectDefinition(undefined);
    expect(store.getState().selectedDefinitionId).toBeUndefined();
  });

  it("ModelStore selects trimmed installed model id", () => {
    const store = new ModelStore({ modelService: {} as any });
    store.selectInstalledModel("  model-1  ");
    expect(store.getState().selectedInstalledModelId).toBe("model-1");
  });

  it("WorkflowStore normalizes node selection", () => {
    const store = new WorkflowStore({
      workflowService: {} as any,
      nodeService: {} as any,
    });
    store.selectNode("  n-1  ");
    expect(store.getState().selectedNodeId).toBe("n-1");
    expect(store.getState().selectedConnectionId).toBeUndefined();
  });

  it("WorkflowStore rename/update metadata APIs mark the workflow dirty", () => {
    const workflow = {
      metadata: { name: "Original", description: "First" },
    } as any;

    const store = new WorkflowStore({
      workflowService: {
        renameWorkflow: (w: any, name: string) => ({ ...w, metadata: { ...w.metadata, name } }),
        setWorkflowDescription: (w: any, description?: string) => ({
          ...w,
          metadata: { ...w.metadata, description },
        }),
      } as any,
      nodeService: {} as any,
      initialState: { currentWorkflow: workflow },
    });

    store.renameCurrentWorkflow("Renamed");
    expect(store.getState().currentWorkflow?.metadata.name).toBe("Renamed");
    expect(store.getState().isDirty).toBeTrue();

    store.updateCurrentWorkflowDescription("Updated");
    expect(store.getState().currentWorkflow?.metadata.description).toBe("Updated");
    expect(store.getState().isDirty).toBeTrue();
  });
  it("WorkflowStore clears editor session state when leaving the editor", () => {
    const store = new WorkflowStore({
      workflowService: {} as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: { id: "wf-1" } as any,
        validation: { isValid: false } as any,
        selectedNodeId: "n-1",
        selectedConnectionId: "c-1",
        isDirty: true,
        isLoading: true,
        isSaving: true,
        isExecuting: true,
        lastExecutionEvent: { executionId: "exec-1" } as any,
        nodeExecutionOutputs: { "n-1": { value: 1 } },
        outputAssets: [{ id: "asset-1" } as any],
        error: "boom",
      },
    });

    store.clearEditorSession();

    expect(store.getState().currentWorkflow).toBeUndefined();
    expect(store.getState().validation).toBeUndefined();
    expect(store.getState().selectedNodeId).toBeUndefined();
    expect(store.getState().selectedConnectionId).toBeUndefined();
    expect(store.getState().isDirty).toBeFalse();
    expect(store.getState().isLoading).toBeFalse();
    expect(store.getState().isSaving).toBeFalse();
    expect(store.getState().isExecuting).toBeFalse();
    expect(store.getState().lastExecutionEvent).toBeUndefined();
    expect(store.getState().nodeExecutionOutputs).toEqual({});
    expect(store.getState().outputAssets).toEqual([]);
    expect(store.getState().error).toBeUndefined();
  });

});
