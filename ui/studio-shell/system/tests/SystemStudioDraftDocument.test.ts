import { describe, expect, it } from "bun:test";
import {
  parseSystemStudioDraftDocument,
  serializeSystemStudioCanvasAuthoringConfiguration,
  serializeSystemStudioPageDefinitions,
} from "../SystemStudioDraftDocument";

describe("SystemStudioDraftDocument", () => {
  it("parses persisted page layouts and page definitions", () => {
    const parsed = parseSystemStudioDraftDocument(JSON.stringify({
      systemSpec: {
        pages: [
          { pageId: "intro", heading: "Welcome", description: "First screen" },
          { pageId: "review", heading: "Review", description: "Final screen" },
        ],
        components: [],
        canvasAuthoring: {
          designFrame: {
            mode: "bounded-frame",
            ratio: { width: 4, height: 3 },
            dimensions: { width: 1200, height: 900 },
            boundedArea: { padding: 24 },
          },
          pageLayouts: [
            {
              pageId: "intro",
              panels: [
                {
                  panelId: "panel-a",
                  pageId: "intro",
                  title: "Panel A",
                  layoutBounds: { x: 0.2, y: 0.1, width: 0.4, height: 0.3 },
                  contentSlots: [{ slotId: "main" }],
                  sourceLayoutNodeId: "node-a",
                },
              ],
            },
          ],
        },
      },
    }));

    expect(parsed.systemSpec.pages).toHaveLength(2);
    expect(parsed.canvasAuthoring.designFrame.ratio?.width).toBe(4);
    expect(parsed.canvasAuthoring.pageLayouts).toHaveLength(2);
    expect(parsed.canvasAuthoring.pageLayouts[0]?.panels).toHaveLength(1);
    expect(parsed.canvasAuthoring.pageLayouts[1]?.panels).toHaveLength(0);
  });

  it("serializes page layouts back into draft content", () => {
    const content = serializeSystemStudioCanvasAuthoringConfiguration({
      existingContent: JSON.stringify({ systemSpec: { components: [] } }),
      canvasAuthoring: {
        designFrame: {
          mode: "bounded-frame",
          ratio: { width: 16, height: 9 },
          dimensions: { width: 1600, height: 900 },
        },
        pageLayouts: [
          {
            pageId: "intro",
            panels: [
              {
                panelId: "panel-a",
                pageId: "intro",
                title: "Panel A",
                layoutBounds: { x: 0, y: 0, width: 0.5, height: 0.5 },
                contentSlots: [],
              },
            ],
          },
        ],
      },
    });

    const parsed = JSON.parse(content) as { readonly systemSpec?: { readonly canvasAuthoring?: { readonly pageLayouts?: ReadonlyArray<unknown> } } };
    expect(parsed.systemSpec?.canvasAuthoring?.pageLayouts).toHaveLength(1);
  });

  it("serializes page definitions", () => {
    const content = serializeSystemStudioPageDefinitions({
      existingContent: JSON.stringify({ systemSpec: { components: [] } }),
      pages: [
        { pageId: "intro", heading: "Welcome", description: "First page" },
      ],
    });

    const parsed = JSON.parse(content) as { readonly systemSpec?: { readonly pages?: ReadonlyArray<{ readonly heading: string }> } };
    expect(parsed.systemSpec?.pages?.[0]?.heading).toBe("Welcome");
  });
});
