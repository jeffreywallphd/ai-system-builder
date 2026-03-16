import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow interactions", () => {
  it("wires WorkflowCanvas to NodeCanvasNode callbacks", () => {
    const canvas = readSource("ui/components/workflow/WorkflowCanvas.tsx");

    expect(canvas).toContain("import NodeCanvasNode");
    expect(canvas).toContain("onPositionChange={onMoveNode}");
    expect(canvas).toContain("onPositionCommit={onMoveNodeCommit}");
    expect(canvas).toContain("onSelect={onSelectNode}");
  });

  it("supports drag cancellation and grid snapping", () => {
    const dragSource = readSource("ui/components/workflow/useNodeDrag.ts");

    expect(dragSource).toContain("handlePointerCancel");
    expect(dragSource).toContain("applyGrid(");
    expect(dragSource).toContain("onDragEnd");
  });
});
