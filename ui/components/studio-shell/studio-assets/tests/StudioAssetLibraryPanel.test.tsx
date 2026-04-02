import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultStudioAssetRegistry } from "../../../../studio-shell/studio-assets/StudioAssetRegistry";
import StudioAssetLibraryPanel from "../StudioAssetLibraryPanel";

describe("StudioAssetLibraryPanel", () => {
  it("renders grouped registry assets with insertion actions", () => {
    const html = renderToStaticMarkup(
      <StudioAssetLibraryPanel
        registry={createDefaultStudioAssetRegistry()}
        onInsertAsset={() => undefined}
      />,
    );

    expect(html).toContain("Asset Library");
    expect(html).toContain("Atomic UI assets");
    expect(html).toContain("Composed UI assets");
    expect(html).toContain("System &amp; page assets");
    expect(html).toContain("Insert");
  });
});
