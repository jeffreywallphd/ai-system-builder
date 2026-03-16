import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/nodes interactions", () => {
  it("wires node inspector to property editor and palette item rendering", () => {
    const inspector = readSource("ui/components/nodes/NodeInspector.tsx");
    const palette = readSource("ui/components/nodes/NodePalette.tsx");
    const propertyEditor = readSource("ui/components/nodes/NodePropertyEditor.tsx");

    expect(inspector).toContain("import NodePropertyEditor");
    expect(inspector).toContain("<NodePropertyEditor");
    expect(palette).toContain("import NodePaletteItem");
    expect(palette).toContain("<NodePaletteItem");
    expect(propertyEditor).toContain("import NodePropertyField");
    expect(propertyEditor).toContain("<NodePropertyField");
  });

  it("supports search, category filter, and reset behavior in palette", () => {
    const palette = readSource("ui/components/nodes/NodePalette.tsx");

    expect(palette).toContain("onSearch?.(query.trim(), categoryFilter || undefined)");
    expect(palette).toContain("onSearch?.(\"\", undefined)");
    expect(palette).toContain("All Categories");
    expect(palette).toContain("No node definitions match the current filters.");
  });

  it("wires node canvas rendering to NodePort and useNodeDrag", () => {
    const canvasNode = readSource("ui/components/nodes/NodeCanvasNode.tsx");

    expect(canvasNode).toContain("import NodePort");
    expect(canvasNode).toContain("useNodeDrag");
    expect(canvasNode).toContain("onDragEnd: onPositionCommit");
  });

});
