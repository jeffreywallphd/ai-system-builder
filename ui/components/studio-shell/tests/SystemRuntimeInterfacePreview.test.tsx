import { describe, expect, it } from "bun:test";
import type { StudioAssetDefinition } from "../../../studio-shell/studio-assets/StudioAssetContracts";
import { renderToStaticMarkup } from "react-dom/server";
import SystemRuntimeInterfacePreview from "../system/SystemRuntimeInterfacePreview";
import { StudioAssetRenderModes } from "../../../studio-shell/studio-assets/StudioAssetContracts";

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

  it("renders embedded studio panel content through host-provided studio asset mapping", () => {
    const embeddedAsset: StudioAssetDefinition = Object.freeze({
      contract: Object.freeze({
        identity: Object.freeze({
          studioType: "test-studio",
          studioId: "test-studio",
          title: "Test studio",
        }),
        supportedModes: Object.freeze([StudioAssetRenderModes.embedded]),
        accepts: Object.freeze({
          context: "studio-host",
          document: "test",
          input: {},
        }),
        emits: Object.freeze(["studio.intent"]),
        hostCapabilities: Object.freeze({
          canNavigate: false,
          canShowShellChrome: false,
          canMutateDraft: false,
          canLaunchRuns: false,
          canManageSessionState: false,
        }),
      }),
      render: () => <div data-testid="embedded-studio-panel">Embedded panel studio</div>,
    });
    const html = renderToStaticMarkup(
      <SystemRuntimeInterfacePreview
        content={JSON.stringify({
          systemSpec: {
            pages: [{ pageId: "page-1", heading: "Home" }],
            canvasAuthoring: {
              pageLayouts: [{
                pageId: "page-1",
                panels: [{
                  panelId: "automation",
                  pageId: "page-1",
                  title: "Automation panel",
                  layoutBounds: { x: 0.1, y: 0.1, width: 0.5, height: 0.4 },
                  contentSlots: [],
                  content: {
                    kind: "embedded-studio",
                    studioAssetId: "test-studio",
                  },
                }],
              }],
            },
          },
        })}
        extensionContext={{
          studioId: "system-studio",
          snapshot: undefined,
          validationIssues: [],
          handoffContext: {},
          isBusy: false,
          operations: {},
        }}
        studioAssetHosts={{
          "test-studio": {
            asset: embeddedAsset,
            resolveInput: () => ({}),
          },
        }}
      />,
    );

    expect(html).toContain("Embedded panel studio");
    expect(html).toContain("data-testid=\"studio-asset-host-boundary\"");
  });
});
