import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow interactions", () => {
  it("wires WorkflowCanvas to ReactFlowCanvas callbacks", () => {
    const canvas = readSource("ui/components/workflow/WorkflowCanvas.tsx");

    expect(canvas).toContain("import ReactFlowCanvas");
    expect(canvas).toContain("onMoveNodeCommit={onMoveNodeCommit}");
    expect(canvas).toContain("onSelectConnection={onSelectConnection}");
    expect(canvas).toContain("onConnectNodes={onConnectNodes}");
  });

  it("wires reactflow events to selection, movement, and connection callbacks", () => {
    const flowCanvas = readSource("ui/components/workflow/reactflow/ReactFlowCanvas.tsx");

    expect(flowCanvas).toContain("onMoveNodeCommit(change.id");
    expect(flowCanvas).toContain("onConnectNodes?.({");
    expect(flowCanvas).toContain("onSelectNode?.(node.id)");
    expect(flowCanvas).toContain("onSelectConnection?.(edge.id)");
  });
});
