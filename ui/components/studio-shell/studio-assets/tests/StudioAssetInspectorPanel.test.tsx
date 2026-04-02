import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StudioAssetInspectorPanel from "../StudioAssetInspectorPanel";
import { createDefaultStudioAssetRegistry } from "../../../../studio-shell/studio-assets/StudioAssetRegistry";

describe("StudioAssetInspectorPanel", () => {
  it("renders an empty selection state", () => {
    const html = renderToStaticMarkup(
      <StudioAssetInspectorPanel registry={createDefaultStudioAssetRegistry()} />,
    );
    expect(html).toContain("Asset Inspector");
    expect(html).toContain("No asset selected.");
  });

  it("renders metadata and schema-driven fields for selected instances", () => {
    const html = renderToStaticMarkup(
      <StudioAssetInspectorPanel
        registry={createDefaultStudioAssetRegistry()}
        selectedAssetNode={Object.freeze({
          nodeId: "node-1",
          assetId: "ui-primitive:text-input",
          assetVersion: "1.0.0",
          config: Object.freeze({ label: "Prompt" }),
        })}
      />,
    );
    expect(html).toContain("Text Input");
    expect(html).toContain("atomic");
    expect(html).toContain("Display");
    expect(html).toContain("Behavior");
    expect(html).toContain("Label");
    expect(html).toContain("studio-asset-preview-card");
  });

  it("binds selected instance from composition + selection context", () => {
    const html = renderToStaticMarkup(
      <StudioAssetInspectorPanel
        registry={createDefaultStudioAssetRegistry()}
        compositionRoot={Object.freeze({
          nodeId: "root-system",
          assetId: "system-studio",
          regions: Object.freeze([
            Object.freeze({
              placementId: "workspace",
              children: Object.freeze([
                Object.freeze({
                  nodeId: "selected-button",
                  assetId: "ui-primitive:button",
                  config: Object.freeze({ label: "Run" }),
                }),
              ]),
            }),
          ]),
        })}
        selection={Object.freeze({ selectedNodeId: "selected-button" })}
      />,
    );

    expect(html).toContain("Button");
    expect(html).toContain("Run");
  });
});
