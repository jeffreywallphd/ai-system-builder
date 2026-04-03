import { describe, expect, it } from "bun:test";
import {
  createDefaultPanelCompositionRoot,
  mapLayoutNodeToPanelAsset,
  mapPanelAssetToRuntimeInstance,
  resolvePanelContainerConfig,
} from "../PanelAssetContracts";

describe("PanelAssetContracts", () => {
  it("maps canvas layout nodes into reusable panel asset contracts", () => {
    const panel = mapLayoutNodeToPanelAsset({
      node: {
        id: "node-a",
        title: "Welcome",
        subtitle: "Greeting panel",
        x: 0.12,
        y: 0.08,
        width: 0.3,
        height: 0.25,
      },
      pageId: "home",
    });

    expect(panel.panelId).toBe("node-a");
    expect(panel.pageId).toBe("home");
    expect(panel.assetId).toBe("ui-composed:panel");
    expect(panel.layoutBounds.width).toBe(0.3);
  });

  it("maps panel contracts into runtime instances", () => {
    const runtime = mapPanelAssetToRuntimeInstance({
      panelId: "panel-hero",
      pageId: "home",
      title: "Hero",
      layoutBounds: { x: 0, y: 0, width: 1, height: 0.4 },
      contentSlots: [],
      assetId: "ui-composed:panel",
      panelType: "composed-panel",
      content: {
        kind: "asset-composition",
        serializedDocument: "{\"schemaVersion\":\"1.1.0\",\"root\":{\"nodeId\":\"panel-hero\",\"assetId\":\"ui-composed:panel\"}}",
      },
    });

    expect(runtime.instanceId).toBe("home:panel-hero");
    expect(runtime.panelId).toBe("panel-hero");
    expect(runtime.assetId).toBe("ui-composed:panel");
    expect(runtime.content?.kind).toBe("asset-composition");
  });

  it("normalizes panel layout and header settings from root config", () => {
    const config = resolvePanelContainerConfig({
      panel: {
        title: "Overview",
        description: "Quick status",
      },
      config: Object.freeze({
        layout: Object.freeze({
          mode: "grid",
          columns: 3,
          gap: 16,
        }),
        header: Object.freeze({
          visible: true,
          title: "Executive summary",
          subtitle: "Daily snapshot",
          showActions: true,
          primaryActionLabel: "Refresh",
        }),
      }),
    });

    expect(config.layout.mode).toBe("grid");
    expect(config.layout.columns).toBe(3);
    expect(config.header.title).toBe("Executive summary");
    expect(config.header.actions[0]?.label).toBe("Refresh");
  });

  it("seeds default panel composition roots with layout and header config", () => {
    const root = createDefaultPanelCompositionRoot({
      panelId: "panel-1",
      pageId: "page-1",
      title: "Main section",
      description: "Section description",
      layoutBounds: { x: 0, y: 0, width: 0.4, height: 0.4 },
      contentSlots: [{ slotId: "panel-content" }],
    });

    expect(root.config?.layout).toBeDefined();
    expect(root.config?.header).toBeDefined();
    expect((root.config?.header as { title?: string }).title).toBe("Main section");
  });
});
