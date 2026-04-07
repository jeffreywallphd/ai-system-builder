import { describe, expect, it } from "bun:test";
import { createDefaultStudioAssetRegistry } from "../StudioAssetRegistry";
import {
  listCompatibleStudioAssetReplacements,
  replaceStudioAssetInCompositionTree,
  StudioAssetReplacementFailureKinds,
} from "../StudioAssetReplacement";

describe("StudioAssetReplacement", () => {
  it("lists compatible replacement candidates for a selected node", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      slots: Object.freeze([
        Object.freeze({
          placementId: "main",
          children: Object.freeze([
            Object.freeze({
              nodeId: "selected-node",
              assetId: "ui-primitive:text-input",
              config: Object.freeze({ label: "Prompt" }),
            }),
          ]),
        }),
      ]),
    });

    const candidates = listCompatibleStudioAssetReplacements({
      registry,
      root,
      nodeId: "selected-node",
    });

    expect(candidates.some((candidate) => candidate.assetId === "ui-primitive:button" && candidate.compatible)).toBeTrue();
    expect(candidates.some((candidate) => candidate.assetId === "system-studio" && !candidate.compatible)).toBeTrue();
  });

  it("replaces selected asset instances while preserving compatible config fields", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      slots: Object.freeze([
        Object.freeze({
          placementId: "main",
          children: Object.freeze([
            Object.freeze({
              nodeId: "selected-node",
              assetId: "ui-primitive:text-input",
              config: Object.freeze({
                label: "Prompt",
                helperText: "Used for run input",
                required: true,
              }),
            }),
          ]),
        }),
      ]),
    });

    const replaced = replaceStudioAssetInCompositionTree({
      registry,
      request: {
        root,
        nodeId: "selected-node",
        replacementAssetId: "ui-primitive:button",
      },
    });

    expect(replaced.ok).toBeTrue();
    if (replaced.ok) {
      expect(replaced.replacedNode.assetId).toBe("ui-primitive:button");
      expect(replaced.replacedNode.config).toEqual(Object.freeze({
        label: "Prompt",
        helperText: "Used for run input",
        isVisible: true,
        required: true,
        readOnly: false,
      }));
    }
  });

  it("returns structured validation failures for incompatible replacements", () => {
    const registry = createDefaultStudioAssetRegistry();
    const root = Object.freeze({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      slots: Object.freeze([
        Object.freeze({
          placementId: "main",
          children: Object.freeze([
            Object.freeze({
              nodeId: "selected-node",
              assetId: "ui-primitive:viewer",
            }),
          ]),
        }),
      ]),
    });

    const replaced = replaceStudioAssetInCompositionTree({
      registry,
      request: {
        root,
        nodeId: "selected-node",
        replacementAssetId: "system-studio",
      },
    });

    expect(replaced.ok).toBeFalse();
    if (!replaced.ok) {
      expect(replaced.kind).toBe(StudioAssetReplacementFailureKinds.invalidByValidation);
      expect(replaced.issues?.length).toBeGreaterThan(0);
    }
  });
});
