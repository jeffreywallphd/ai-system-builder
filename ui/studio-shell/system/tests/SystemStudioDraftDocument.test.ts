import { describe, expect, it } from "bun:test";
import {
  parseSystemStudioDraftDocument,
  serializeSystemStudioCanvasAuthoringConfiguration,
} from "../SystemStudioDraftDocument";

describe("SystemStudioDraftDocument", () => {
  it("parses persisted canvas authoring panels and design frame", () => {
    const parsed = parseSystemStudioDraftDocument(JSON.stringify({
      systemSpec: {
        components: [],
        canvasAuthoring: {
          designFrame: {
            mode: "bounded-frame",
            ratio: { width: 4, height: 3 },
            dimensions: { width: 1200, height: 900 },
            boundedArea: { padding: 24 },
          },
          panels: [
            {
              panelId: "panel-a",
              pageId: "default",
              title: "Panel A",
              layoutBounds: { x: 0.2, y: 0.1, width: 0.4, height: 0.3 },
              contentSlots: [{ slotId: "main" }],
              sourceLayoutNodeId: "node-a",
            },
          ],
        },
      },
    }));

    expect(parsed.canvasAuthoring.designFrame.ratio?.width).toBe(4);
    expect(parsed.canvasAuthoring.panels).toHaveLength(1);
    expect(parsed.canvasAuthoring.panels[0]?.layoutBounds.width).toBe(0.4);
  });

  it("serializes canvas authoring config back into draft content", () => {
    const content = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: JSON.stringify({ systemSpec: { components: [] } }),
      canvasAuthoring: {
        designFrame: {
          mode: "bounded-frame",
          ratio: { width: 16, height: 9 },
          dimensions: { width: 1600, height: 900 },
        },
        panels: [
          {
            panelId: "panel-a",
            pageId: "default",
            title: "Panel A",
            layoutBounds: { x: 0, y: 0, width: 0.5, height: 0.5 },
            contentSlots: [],
          },
        ],
      },
    });

    const parsed = JSON.parse(content) as { readonly systemSpec?: { readonly canvasAuthoring?: { readonly panels?: ReadonlyArray<unknown> } } };
    expect(parsed.systemSpec?.canvasAuthoring?.panels).toHaveLength(1);
  });
});
