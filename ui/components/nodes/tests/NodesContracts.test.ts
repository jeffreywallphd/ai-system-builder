import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/nodes contract adherence", () => {
  it("defines typed props for each node component", () => {
    const paletteItem = readSource("ui/components/nodes/NodePaletteItem.tsx");
    const palette = readSource("ui/components/nodes/NodePalette.tsx");
    const propertyField = readSource("ui/components/nodes/NodePropertyField.tsx");
    const propertyEditor = readSource("ui/components/nodes/NodePropertyEditor.tsx");
    const inspector = readSource("ui/components/nodes/NodeInspector.tsx");

    expect(paletteItem).toContain("export interface NodePaletteItemProps");
    expect(palette).toContain("export interface NodePaletteProps");
    expect(propertyField).toContain("export interface NodePropertyFieldProps");
    expect(propertyEditor).toContain("export interface NodePropertyEditorProps");
    expect(inspector).toContain("export interface NodeInspectorProps");
  });

  it("maps field types to expected control rendering branches", () => {
    const propertyField = readSource("ui/components/nodes/NodePropertyField.tsx");

    expect(propertyField).toContain('case "boolean"');
    expect(propertyField).toContain('case "integer"');
    expect(propertyField).toContain('case "select"');
    expect(propertyField).toContain('case "multi-select"');
    expect(propertyField).toContain('case "model-list"');
    expect(propertyField).toContain('case "json"');
  });
});
