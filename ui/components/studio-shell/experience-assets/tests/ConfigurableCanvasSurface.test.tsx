import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConfigurableCanvasSurface from "../ConfigurableCanvasSurface";

describe("ConfigurableCanvasSurface", () => {
  it("renders direct canvas engine hosts and shell regions", () => {
    const html = renderToStaticMarkup(
      <ConfigurableCanvasSurface
        identity={{ id: "canvas-a", title: "Canvas A", summary: "Test canvas." }}
        graphSummary={{ nodeCount: 3, edgeCount: 2, issueCount: 1 }}
        focusedTarget={{ kind: "node", id: "node-1", label: "Node 1" }}
        palette={{ title: "Palette" }}
        issues={[{ id: "issue-1", message: "Node 1 requires input" }]}
        renderGraphInteractionShell={() => <div data-testid="graph-host">Graph host</div>}
        renderPaletteRegion={() => <div data-testid="palette-host">Palette host</div>}
        renderInspectorRegion={() => <div data-testid="inspector-host">Inspector host</div>}
      />, 
    );

    expect(html).toContain('data-testid="configurable-canvas-shell"');
    expect(html).toContain('data-testid="graph-host"');
    expect(html).toContain('data-testid="palette-host"');
    expect(html).toContain('data-testid="configurable-canvas-issues"');
  });

  it("renders from canvas asset definition format", () => {
    const html = renderToStaticMarkup(
      <ConfigurableCanvasSurface
        definition={{
          identity: { id: "canvas-def", title: "Canvas Definition" },
          resolveGraphSummary: () => ({ nodeCount: 5, edgeCount: 4, issueCount: 0 }),
          resolveFocusedTarget: () => ({ kind: "edge", id: "edge-1", label: "Edge 1" }),
          resolvePalette: () => ({ title: "Palette", description: "Blocks" }),
          renderGraphInteractionShell: () => <div data-testid="definition-graph-host">Definition graph host</div>,
          renderPaletteRegion: () => <div data-testid="definition-palette-host">Definition palette host</div>,
          renderInspectorRegion: () => <div data-testid="definition-inspector-host">Definition inspector host</div>,
        }}
        definitionContext={{ revision: 1 }}
        rightDrawer={{ label: "Inspector", isEnabled: true, isOpen: true }}
      />, 
    );

    expect(html).toContain('data-testid="definition-graph-host"');
    expect(html).toContain('data-testid="configurable-canvas-right-drawer"');
    expect(html).toContain('data-testid="definition-inspector-host"');
  });

  it("renders reusable editing-surface layout nodes", () => {
    const html = renderToStaticMarkup(
      <ConfigurableCanvasSurface
        definition={{
          identity: { id: "editable-canvas", title: "Editable Canvas" },
          resolveGraphSummary: () => ({ nodeCount: 1, edgeCount: 0 }),
          resolveEditingModel: () => ({
            selectedNodeId: "layout-1",
            commands: [{ id: "reset", label: "Reset" }],
            nodes: [{
              id: "layout-1",
              title: "Panel",
              x: 40,
              y: 48,
              width: 200,
              height: 140,
              minWidth: 160,
              minHeight: 90,
            }],
          }),
        }}
        definitionContext={{}}
      />,
    );

    expect(html).toContain('data-testid="configurable-canvas-editing-surface"');
    expect(html).toContain('data-testid="configurable-canvas-layout-node-layout-1"');
  });

});
