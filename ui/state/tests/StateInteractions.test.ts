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
});
