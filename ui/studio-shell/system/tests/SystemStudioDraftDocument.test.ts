import { describe, expect, it } from "bun:test";
import {
  parseSystemStudioDraftDocument,
  serializeSystemStudioCanvasAuthoringConfiguration,
  serializeSystemStudioEmbeddedDatasetDraftContent,
  serializeSystemStudioEmbeddedWorkflowDraftContent,
  serializeSystemStudioPageDefinitions,
} from "../SystemStudioDraftDocument";

describe("SystemStudioDraftDocument", () => {
  it("parses persisted page layouts and page definitions", () => {
    const parsed = parseSystemStudioDraftDocument(JSON.stringify({
      systemSpec: {
        pages: [
          { pageId: "intro", title: "Welcome", description: "First screen" },
          { pageId: "review", title: "Review", description: "Final screen" },
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
                  content: {
                    kind: "embedded-studio",
                    studioAssetId: "workflow-studio",
                    draftContent: "{\"steps\":[]}",
                  },
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
    expect(parsed.canvasAuthoring.pageLayouts[0]?.panels[0]?.content?.kind).toBe("embedded-studio");
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
        { pageId: "intro", title: "Welcome", description: "First page", layout: { layoutKind: "workspace", regionIds: ["workspace"] } },
      ],
    });

    const parsed = JSON.parse(content) as { readonly systemSpec?: { readonly pages?: ReadonlyArray<{ readonly title: string }> } };
    expect(parsed.systemSpec?.pages?.[0]?.title).toBe("Welcome");
  });

  it("serializes and parses embedded dataset draft content", () => {
    const nextContent = serializeSystemStudioEmbeddedDatasetDraftContent({
      existingContent: JSON.stringify({ systemSpec: { components: [] } }),
      draftContent: "{\"pipeline\":\"inputs-outputs\"}",
    });

    const parsed = parseSystemStudioDraftDocument(nextContent);
    expect(parsed.systemSpec.embeddedStudios?.dataset?.draftContent).toBe("{\"pipeline\":\"inputs-outputs\"}");
    expect(parsed.systemSpec.sharedDocument?.datasetDraftContent).toBe("{\"pipeline\":\"inputs-outputs\"}");
  });

  it("serializes and parses embedded workflow draft content", () => {
    const nextContent = serializeSystemStudioEmbeddedWorkflowDraftContent({
      existingContent: JSON.stringify({ systemSpec: { components: [] } }),
      draftContent: "{\"steps\":[{\"stepId\":\"step-1\"}]}",
    });

    const parsed = parseSystemStudioDraftDocument(nextContent);
    expect(parsed.systemSpec.embeddedStudios?.workflow?.draftContent).toBe("{\"steps\":[{\"stepId\":\"step-1\"}]}");
    expect(parsed.systemSpec.sharedDocument?.workflowDraftContent).toBe("{\"steps\":[{\"stepId\":\"step-1\"}]}");
  });

  it("keeps embedded dataset/workflow drafts in shared document fields", () => {
    const baseContent = JSON.stringify({
      systemSpec: {
        sharedDocument: {
          datasetDraftContent: "old-dataset",
          workflowDraftContent: "old-workflow",
        },
      },
    });

    const withDatasetUpdate = serializeSystemStudioEmbeddedDatasetDraftContent({
      existingContent: baseContent,
      draftContent: "new-dataset",
    });
    const withWorkflowUpdate = serializeSystemStudioEmbeddedWorkflowDraftContent({
      existingContent: withDatasetUpdate,
      draftContent: "new-workflow",
    });
    const parsed = parseSystemStudioDraftDocument(withWorkflowUpdate);

    expect(parsed.systemSpec.sharedDocument?.datasetDraftContent).toBe("new-dataset");
    expect(parsed.systemSpec.sharedDocument?.workflowDraftContent).toBe("new-workflow");
  });

});
