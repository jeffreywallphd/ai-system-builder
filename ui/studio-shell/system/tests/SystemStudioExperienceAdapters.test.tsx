import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createSystemCanvasExperienceDefinition } from "../SystemCanvasExperienceAdapter";
import type { StudioShellExtensionContext } from "../../StudioShellExtensions";

const extensionContext: StudioShellExtensionContext = Object.freeze({
  studioId: "studio-systems",
  snapshot: undefined,
  validationIssues: Object.freeze([]),
  handoffContext: Object.freeze({}),
  isBusy: false,
  operations: Object.freeze({
    refresh: async () => undefined,
  }),
});

describe("System studio experience adapters", () => {
  const buildCanvasModel = (content: string) => createSystemCanvasExperienceDefinition({
    content,
    extensionContext,
    validationIssues: [],
    selectedPageId: "page-1",
    onSelectPage: () => undefined,
  });

  it("maps selected page layout panels into the reusable canvas editing model", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [
          { pageId: "page-1", title: "Welcome" },
          { pageId: "page-2", title: "Summary" },
        ],
        canvasAuthoring: {
          designFrame: {
            mode: "bounded-frame",
            ratio: { width: 16, height: 9 },
            dimensions: { width: 1600, height: 900 },
          },
          pageLayouts: [
            {
              pageId: "page-2",
              panels: [
                {
                  panelId: "panel-1",
                  pageId: "page-2",
                  regionId: "left-pane",
                  title: "Main panel",
                  layoutBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                  contentSlots: [],
                  sourceLayoutNodeId: "panel-1",
                },
              ],
            },
          ],
        },
      },
    });

    const model = createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues: [],
      selectedPageId: "page-2",
      onSelectPage: () => undefined,
    });

    const editing = model.definition.resolveEditingModel?.(model.context);
    expect(editing?.nodes).toHaveLength(1);
    expect(editing?.nodes[0]?.title).toBe("Main panel");
    expect(editing?.nodes[0]?.subtitle).toContain("left-pane");
    expect(editing?.commands?.map((command) => command.id)).toEqual(["add-panel", "remove-panel", "fit-layout"]);
    expect(editing?.snap).toEqual({
      enabled: true,
      divisions: { x: 10, y: 10 },
      timing: { duringDrag: false, onRelease: true },
      targets: { position: true, size: true, bounds: true },
    });
  });

  it("opens the embedded panel design studio when a canvas panel is selected", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [{ pageId: "page-1", title: "Welcome" }],
        canvasAuthoring: {
          pageLayouts: [{
            pageId: "page-1",
            panels: [{
              panelId: "panel-1",
              pageId: "page-1",
              title: "Automation",
              layoutBounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
              contentSlots: [],
              sourceLayoutNodeId: "panel-1",
              content: {
                kind: "asset-composition",
                serializedDocument: "{\"schemaVersion\":\"1.1.0\",\"root\":{\"nodeId\":\"panel-1\",\"assetId\":\"ui-composed:panel\",\"assetVersion\":\"1.0.0\",\"slots\":[{\"placementId\":\"panel-content\",\"children\":[]}]}}",
              },
            }],
          }],
        },
      },
    });

    const model = createSystemCanvasExperienceDefinition({
      content,
      extensionContext,
      validationIssues: [],
      selectedPageId: "page-1",
      selectedLayoutNodeId: "panel-1",
      onSelectPage: () => undefined,
      onPanelCompositionChange: () => undefined,
    });

    const inspector = model.definition.renderInspectorRegion?.({
      context: model.context,
      inspector: Object.freeze({
        focusedTarget: Object.freeze({
          kind: "node",
          id: "panel-1",
          label: "Automation",
        }),
      }),
    });
    const html = renderToStaticMarkup(<>{inspector}</>);
    expect(html).toContain("Designing: Automation");
    expect(html).toContain("data-testid=\"panel-design-studio\"");
  });

  it("builds a canvas model with expected page-selection context", () => {
    const content = JSON.stringify({
      systemSpec: {
        pages: [{ pageId: "page-1", title: "Welcome" }],
      },
    });
    const model = buildCanvasModel(content);
    expect(model.context.selectedPageId).toBe("page-1");
  });
});
