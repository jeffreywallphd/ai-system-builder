import { describe, expect, it } from "bun:test";
import { applyConfigToSelectedStudioAsset, bindStudioAssetSelection } from "../StudioAssetSelection";

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

  it("binds the selected instance from composition roots", () => {
    const bound = bindStudioAssetSelection({
      root,
      selection: Object.freeze({ selectedNodeId: "child-input" }),
    });

    expect(bound.selectedNode?.assetId).toBe("ui-primitive:text-input");
    expect((bound.selectedNode?.config as Record<string, unknown>)?.label).toBe("Before");
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
