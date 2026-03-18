import { describe, expect, it } from "bun:test";
import { WorkflowStore } from "../WorkflowStore";

describe("ui/state interactions", () => {
  it("createWorkflow updates current workflow and dirty flag", async () => {
    const created = { id: "w1" } as any;
    const store = new WorkflowStore({
      workflowService: {
        createWorkflow: async () => ({ workflow: created }),
      } as any,
      nodeService: {} as any,
    });

    await store.createWorkflow({ name: "Test" } as any);

    expect(store.getState().currentWorkflow).toBe(created);
    expect(store.getState().isDirty).toBeTrue();
    expect(store.getState().isLoading).toBeFalse();
  });

  it("does not overwrite dirty in-memory workflow when a stale load resolves", async () => {
    let resolveLoad: ((value: any) => void) | undefined;
    const localWorkflow = { id: "w1", nodes: [{ id: "n-local" }] } as any;
    const remoteWorkflow = { id: "w1", nodes: [] } as any;

    const store = new WorkflowStore({
      workflowService: {
        loadWorkflow: async () =>
          await new Promise((resolve) => {
            resolveLoad = resolve;
          }),
      } as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: localWorkflow,
        isDirty: true,
      },
    });

    const pending = store.loadWorkflow("w1");
    resolveLoad?.(remoteWorkflow);
    await pending;

    expect(store.getState().currentWorkflow).toBe(localWorkflow);
    expect(store.getState().isDirty).toBeTrue();
  });

  it("captures workflow output assets from execution events and results", async () => {
    const workflow = { id: "wf-1" } as any;
    const outputAsset = { id: "asset-1", name: "Result", kind: "image" } as any;
    const store = new WorkflowStore({
      workflowService: {
        executeWorkflow: async (_request: any, onEvent?: (event: any) => void) => {
          onEvent?.({
            executionId: "exec-1",
            kind: "asset-produced",
            status: "running",
            asset: outputAsset,
          });

          return {
            effectiveWorkflow: workflow,
            result: {
              executionId: "exec-1",
              status: "completed",
              outputAssets: [outputAsset],
            },
          };
        },
      } as any,
      nodeService: {} as any,
      initialState: {
        currentWorkflow: workflow,
      },
    });

    await store.executeCurrentWorkflow();

    expect(store.getState().outputAssets).toEqual([outputAsset]);
    expect(store.getState().isExecuting).toBeFalse();
  });

});
