import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/nodes unit coverage", () => {
  it("defines node palette and inspector component modules", () => {
    const palette = readSource("ui/components/nodes/NodePalette.tsx");
    const paletteItem = readSource("ui/components/nodes/NodePaletteItem.tsx");
    const propertyField = readSource("ui/components/nodes/NodePropertyField.tsx");
    const propertyEditor = readSource("ui/components/nodes/NodePropertyEditor.tsx");
    const inspector = readSource("ui/components/nodes/NodeInspector.tsx");
    const nodePort = readSource("ui/components/nodes/NodePort.tsx");
    const canvasNode = readSource("ui/components/nodes/NodeCanvasNode.tsx");

    expect(palette).toContain("export default function NodePalette");
    expect(paletteItem).toContain("export default function NodePaletteItem");
    expect(propertyField).toContain("export default function NodePropertyField");
    expect(propertyEditor).toContain("export default function NodePropertyEditor");
    expect(inspector).toContain("export default function NodeInspector");
    expect(nodePort).toContain("export default function NodePort");
    expect(canvasNode).toContain("export default function NodeCanvasNode");
  });
});
