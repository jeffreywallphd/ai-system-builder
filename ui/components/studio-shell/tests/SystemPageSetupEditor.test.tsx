import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SystemPageSetupEditor } from "../system/SystemPageSetupEditor";

describe("SystemPageSetupEditor", () => {
  it("renders creation flow and page list details for non-technical setup", () => {
    const html = renderToStaticMarkup(
      <SystemPageSetupEditor
        pages={[
          {
            pageId: "page-1",
            title: "Welcome",
            description: "Start a run",
            layout: {
              layoutKind: "workspace",
              defaultRegionId: "workspace",
              regionIds: ["workspace", "inspector"],
            },
            navigation: {
              route: "/welcome",
              title: "Welcome",
              supportsDeepLinking: false,
              requiresRuntimeSession: false,
            },
          },
        ]}
        selectedPageId="page-1"
        onSelectPage={() => undefined}
        onPagesChange={() => undefined}
      />,
    );

    expect(html).toContain("Set up your screens");
    expect(html).toContain("Create screen");
    expect(html).toContain("Screen list");
    expect(html).toContain("Layout regions: workspace, inspector");
  });

  it("shows an empty-state prompt when there are no pages", () => {
    const html = renderToStaticMarkup(
      <SystemPageSetupEditor
        pages={[]}
        selectedPageId="page-1"
        onSelectPage={() => undefined}
        onPagesChange={() => undefined}
      />,
    );

    expect(html).toContain("No screens yet");
    expect(html).toContain("Create your first screen above");
  });
});
