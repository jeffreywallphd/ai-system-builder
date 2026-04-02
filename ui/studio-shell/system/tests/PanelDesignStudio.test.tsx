import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PanelDesignStudio from "../../../components/studio-shell/system/PanelDesignStudio";

describe("PanelDesignStudio", () => {
  it("shows panel and child assets in the embedded selection context", () => {
    const html = renderToStaticMarkup(
      <PanelDesignStudio
        panel={Object.freeze({
          panelId: "panel-1",
          pageId: "page-1",
          title: "Summary panel",
          layoutBounds: Object.freeze({ x: 0, y: 0, width: 0.5, height: 0.4 }),
          contentSlots: Object.freeze([{ slotId: "panel-content", label: "Panel content" }]),
          content: Object.freeze({
            kind: "asset-composition",
            serializedDocument: "{\"schemaVersion\":\"1.1.0\",\"root\":{\"nodeId\":\"panel-1\",\"assetId\":\"ui-composed:panel\",\"assetVersion\":\"1.0.0\",\"slots\":[{\"placementId\":\"panel-content\",\"children\":[{\"nodeId\":\"child-button\",\"assetId\":\"ui-primitive:button\",\"assetVersion\":\"1.0.0\"}]}]}}",
          }),
        })}
        onChangePanel={() => undefined}
      />,
    );

    expect(html).toContain("What you&#x27;re editing");
    expect(html).toContain("Panel");
    expect(html).toContain("Button");
    expect(html).toContain("Adding content to");
  });

  it("shows an invalid-target message when the selected composition cannot accept children", () => {
    const html = renderToStaticMarkup(
      <PanelDesignStudio
        panel={Object.freeze({
          panelId: "panel-atomic",
          pageId: "page-1",
          title: "Atomic panel",
          layoutBounds: Object.freeze({ x: 0, y: 0, width: 0.5, height: 0.4 }),
          contentSlots: Object.freeze([{ slotId: "panel-content", label: "Panel content" }]),
          content: Object.freeze({
            kind: "asset-composition",
            serializedDocument: "{\"schemaVersion\":\"1.1.0\",\"root\":{\"nodeId\":\"panel-atomic\",\"assetId\":\"ui-primitive:text-input\",\"assetVersion\":\"1.0.0\"}}",
          }),
        })}
        onChangePanel={() => undefined}
      />,
    );

    expect(html).toContain("cannot hold child content");
    expect(html).toContain("Select a container item to browse assets you can add here.");
  });
});
