import { describe, expect, it } from "bun:test";
import {
  mapLayoutNodeToPanelAsset,
  mapPanelAssetToRuntimeInstance,
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
    expect(panel.layoutBounds.width).toBe(0.3);
  });

  it("maps panel contracts into runtime instances", () => {
    const runtime = mapPanelAssetToRuntimeInstance({
      panelId: "panel-hero",
      pageId: "home",
      title: "Hero",
      layoutBounds: { x: 0, y: 0, width: 1, height: 0.4 },
      contentSlots: [],
      content: {
        kind: "embedded-studio",
        studioAssetId: "workflow-studio",
        draftContent: "{\"steps\":[]}",
      },
    });

    expect(runtime.instanceId).toBe("home:panel-hero");
    expect(runtime.panelId).toBe("panel-hero");
    expect(runtime.content?.kind).toBe("embedded-studio");
  });
});
