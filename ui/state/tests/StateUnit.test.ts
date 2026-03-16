import { describe, expect, it } from "bun:test";
import { NodeStore } from "../NodeStore";
import { ModelStore } from "../ModelStore";
import { WorkflowStore } from "../WorkflowStore";

describe("ui/state unit coverage", () => {
  it("NodeStore clears selection when selecting undefined", async () => {
    const store = new NodeStore({ nodeService: {} as any, initialState: { selectedDefinitionId: "d1" } });
    await store.selectDefinition(undefined);
    expect(store.getState().selectedDefinitionId).toBeUndefined();
  });

  it("ModelStore selects trimmed installed model id", () => {
    const store = new ModelStore({ modelService: {} as any });
    store.selectInstalledModel("  model-1  ");
    expect(store.getState().selectedInstalledModelId).toBe("model-1");
  });

  it("WorkflowStore normalizes node selection", () => {
    const store = new WorkflowStore({ workflowService: {} as any, nodeService: {} as any });
    store.selectNode("  n-1  ");
    expect(store.getState().selectedNodeId).toBe("n-1");
    expect(store.getState().selectedConnectionId).toBeUndefined();
  });
});
