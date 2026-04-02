import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import SystemRuntimeInterfacePreview from "../system/SystemRuntimeInterfacePreview";

describe("SystemRuntimeInterfacePreview", () => {
  it("renders authored page layout panels and empty-state pages from draft content", () => {
    const html = renderToStaticMarkup(
      <SystemRuntimeInterfacePreview
        content={JSON.stringify({
          systemSpec: {
            pages: [
              { pageId: "page-1", heading: "Home" },
              { pageId: "page-2", heading: "Review" },
            ],
            canvasAuthoring: {
              pageLayouts: [
                {
                  pageId: "page-1",
                  panels: [
                    {
                      panelId: "hero",
                      pageId: "page-1",
                      title: "Hero panel",
                      description: "Intro content",
                      layoutBounds: { x: 0.1, y: 0.1, width: 0.5, height: 0.4 },
                      contentSlots: [],
                    },
                  ],
                },
                {
                  pageId: "page-2",
                  panels: [],
                },
              ],
            },
          },
        })}
      />,
    );

    expect(html).toContain("Interface preview");
    expect(html).toContain("Hero panel");
    expect(html).toContain("data-testid=\"system-runtime-interface-pages\"");
  });
});
