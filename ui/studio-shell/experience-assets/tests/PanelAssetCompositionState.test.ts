import { describe, expect, it } from "bun:test";
import { resolvePanelCompositionState } from "../PanelAssetCompositionState";
import { createDefaultStudioAssetRegistry } from "../../studio-assets/StudioAssetRegistry";

describe("PanelAssetCompositionState", () => {
  const registry = createDefaultStudioAssetRegistry();

  it("flags new panels with no children as ready for content", () => {
    const state = resolvePanelCompositionState({
      registry,
      panel: {
        panelId: "panel-empty",
        pageId: "page-1",
        title: "Overview",
        layoutBounds: { x: 0, y: 0, width: 0.5, height: 0.4 },
        contentSlots: [{ slotId: "panel-content", label: "Panel content" }],
      },
    });

    expect(state.childCount).toBe(0);
    expect(state.notice?.kind).toBe("empty");
  });

  it("keeps composed panels without issues in ready status", () => {
    const state = resolvePanelCompositionState({
      registry,
      panel: {
        panelId: "panel-ready",
        pageId: "page-1",
        title: "Overview",
        layoutBounds: { x: 0, y: 0, width: 0.5, height: 0.4 },
        contentSlots: [{ slotId: "panel-content", label: "Panel content" }],
        content: {
          kind: "asset-composition",
          serializedDocument:
            '{"schemaVersion":"1.1.0","root":{"nodeId":"panel-ready","assetId":"ui-composed:panel","assetVersion":"1.0.0","slots":[{"placementId":"panel-content","children":[{"nodeId":"button-1","assetId":"ui-primitive:button","assetVersion":"1.0.0"}]}]}}',
        },
      },
    });

    expect(state.childCount).toBe(1);
    expect(state.notice).toBeUndefined();
  });

  it("reports recoverable issues when child references cannot be resolved", () => {
    const state = resolvePanelCompositionState({
      registry,
      panel: {
        panelId: "panel-missing",
        pageId: "page-1",
        title: "Overview",
        layoutBounds: { x: 0, y: 0, width: 0.5, height: 0.4 },
        contentSlots: [{ slotId: "panel-content", label: "Panel content" }],
        content: {
          kind: "asset-composition",
          serializedDocument:
            '{"schemaVersion":"1.1.0","root":{"nodeId":"panel-missing","assetId":"ui-composed:panel","assetVersion":"1.0.0","slots":[{"placementId":"panel-content","children":[{"nodeId":"missing-1","assetId":"ui-primitive:missing","assetVersion":"1.0.0"}]}]}}',
        },
      },
    });

    expect(state.notice?.kind).toBe("invalid-configuration");
    expect(state.validationIssues.length).toBeGreaterThan(0);
  });
});
