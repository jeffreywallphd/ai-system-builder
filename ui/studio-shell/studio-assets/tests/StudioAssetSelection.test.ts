import { describe, expect, it } from "bun:test";
import {
  applyConfigToSelectedStudioAsset,
  bindStudioAssetSelection,
  createStudioAssetSelectionState,
  navigateStudioAssetSelectionToPathNode,
} from "../StudioAssetSelection";

describe("StudioAssetSelection", () => {
  const root = Object.freeze({
    nodeId: "root-system",
    assetId: "system-studio",
    regions: Object.freeze([
      Object.freeze({
        placementId: "workspace",
        children: Object.freeze([
          Object.freeze({
            nodeId: "child-workflow",
            assetId: "workflow-studio",
            slots: Object.freeze([
              Object.freeze({
                placementId: "main",
                children: Object.freeze([
                  Object.freeze({
                    nodeId: "child-input",
                    assetId: "ui-primitive:text-input",
                    config: Object.freeze({ label: "Before" }),
                  }),
                ]),
              }),
            ]),
          }),
        ]),
      }),
    ]),
  });

  it("binds selected instances with nested breadcrumb path details", () => {
    const bound = bindStudioAssetSelection({
      root,
      selection: Object.freeze({ selectedNodeId: "child-input" }),
    });

    expect(bound.selectedNode?.assetId).toBe("ui-primitive:text-input");
    expect((bound.selectedNode?.config as Record<string, unknown>)?.label).toBe("Before");
    expect(bound.path.map((entry) => entry.nodeId)).toEqual([
      "root-system",
      "child-workflow",
      "child-input",
    ]);
    expect(bound.focusedNodeId).toBe("child-input");
  });

  it("supports navigating selection focus to parent path nodes", () => {
    const selection = createStudioAssetSelectionState({
      root,
      nodeId: "child-input",
    });

    const narrowed = navigateStudioAssetSelectionToPathNode({
      root,
      selection,
      nodeId: "child-workflow",
    });

    const rebound = bindStudioAssetSelection({ root, selection: narrowed });
    expect(rebound.selectedNodeId).toBe("child-input");
    expect(rebound.focusedNodeId).toBe("child-workflow");
  });

  it("gracefully marks stale nested selections when nodes disappear", () => {
    const bound = bindStudioAssetSelection({
      root,
      selection: Object.freeze({ selectedNodeId: "removed-node" }),
    });

    expect(bound.selectedNode).toBeUndefined();
    expect(bound.stale).toBe(true);
  });

  it("applies inspector config updates to the selected instance id", () => {
    const nextRoot = applyConfigToSelectedStudioAsset({
      root,
      selection: Object.freeze({ selectedNodeId: "child-input" }),
      config: Object.freeze({ label: "After", required: true }),
    });

    const rebound = bindStudioAssetSelection({
      root: nextRoot,
      selection: Object.freeze({ selectedNodeId: "child-input" }),
    });

    expect((rebound.selectedNode?.config as Record<string, unknown>)?.label).toBe("After");
    expect((rebound.selectedNode?.config as Record<string, unknown>)?.required).toBe(true);
  });
});
